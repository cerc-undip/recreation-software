import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCode, _resetCache } from "./piston";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Piston execution adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    _resetCache();
  });

  it("handles successful execution", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ language: "python", version: "3.10.0" }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        run: { code: 0, stdout: "hello\n", stderr: "", signal: null },
      }),
    });

    const result = await runCode("print('hello')", "", 1000);
    expect(result).toEqual({
      status: "success",
      stdout: "hello\n",
      stderr: "",
      exitCode: 0,
    });
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).files[0].content).toContain("CodeArena runner");
  });

  it("handles runtime errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ language: "python", version: "3.10.0" }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        run: { code: 1, stdout: "", stderr: "NameError: name 'x' is not defined", signal: null },
      }),
    });

    const result = await runCode("print(x)", "", 1000);
    expect(result).toEqual({
      status: "runtime_error",
      stderr: "NameError: name 'x' is not defined",
      exitCode: 1,
    });
  });

  it("handles syntax errors (mapped to compile_error if compile stage fails)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ language: "python", version: "3.10.0" }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        compile: { code: 1, stderr: "SyntaxError: invalid syntax" },
        run: { code: 1, stdout: "", stderr: "SyntaxError: invalid syntax", signal: null },
      }),
    });

    const result = await runCode("def", "", 1000);
    expect(result).toEqual({
      status: "compile_error",
      stderr: "SyntaxError: invalid syntax",
    });
  });

  it("handles timeout signals", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ language: "python", version: "3.10.0" }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        run: { code: 137, stdout: "", stderr: "", signal: "SIGKILL" },
      }),
    });

    const result = await runCode("while True: pass", "", 1000);
    expect(result).toEqual({
      status: "timeout",
      message: "Execution timed out",
    });
  });

  it("handles output-limit transport errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ language: "python", version: "3.10.0" }],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        run: {
          code: 1,
          stdout: "",
          stderr: "",
          output: "",
          message: "stdout length exceeded",
          signal: null,
          status: "OL",
        },
      }),
    });

    const result = await runCode("print('x' * 100000)", "", 1000);
    expect(result).toEqual({
      status: "runtime_error",
      stderr: "stdout length exceeded",
      exitCode: 1,
    });
  });

  it("handles AbortError timeouts", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ language: "python", version: "3.10.0" }],
    });
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortErr);

    const result = await runCode("while True: pass", "", 1000);
    expect(result).toEqual({
      status: "timeout",
      message: "Execution timed out",
    });
  });

  it("handles unreachable Piston", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ language: "python", version: "3.10.0" }],
    });
    mockFetch.mockRejectedValueOnce(new Error("fetch failed"));

    const result = await runCode("print('x')", "", 1000);
    expect(result).toEqual({
      status: "unreachable",
      message: "fetch failed",
    });
  });

  it("handles malformed runtimes response", async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ not_an_array: true }),
    });

    const result = await runCode("print('x')", "", 1000);
    expect(result).toEqual({
      status: "unreachable",
      message: "Failed to resolve Python runtime: Invalid runtimes format",
    });
  });

  it("handles missing Python runtime", async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ language: "node", version: "18.0.0" }],
    });

    const result = await runCode("print('x')", "", 1000);
    expect(result).toEqual({
      status: "unreachable",
      message: "Failed to resolve Python runtime: Python runtime not found on Piston",
    });
  });
});
