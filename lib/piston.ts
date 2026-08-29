export type PistonResult =
  | { status: "success"; stdout: string; stderr: string; exitCode: number }
  | { status: "compile_error"; stderr: string }
  | { status: "runtime_error"; stderr: string; exitCode: number }
  | { status: "timeout"; message: string }
  | { status: "unreachable"; message: string };

interface RuntimeEntry {
  readonly language: string;
  readonly version: string;
}

interface PistonCompileStage {
  readonly code: number;
  readonly stderr: string;
}

interface PistonRunStage {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly signal: string | null;
  readonly output: string;
  readonly message: string | null;
  readonly status: string | null;
}

interface PistonExecuteResponse {
  readonly compile?: PistonCompileStage;
  readonly run: PistonRunStage;
}

const PISTON_API_URL = process.env["PISTON_API_URL"] || "http://localhost:2000";

const PYTHON_FUNCTION_HARNESS = String.raw`
# CodeArena runner: call returned-function solutions and print return values.
if __name__ == "__main__":
    import sys as __codearena_sys
    __codearena_input = __codearena_sys.stdin.read().rstrip("\n")
    __codearena_fn = globals().get("solve")
    if not callable(__codearena_fn):
        __codearena_user_functions = [
            __value for __name, __value in globals().items()
            if callable(__value)
            and getattr(__value, "__module__", None) == "__main__"
            and not __name.startswith("__codearena_")
        ]
        __codearena_fn = __codearena_user_functions[0] if len(__codearena_user_functions) == 1 else None
    if callable(__codearena_fn):
        try:
            __codearena_result = __codearena_fn(__codearena_input)
        except TypeError:
            __codearena_result = __codearena_fn()
        if __codearena_result is not None:
            print(__codearena_result)
`;

let memoizedVersion: string | null = null;

export function _resetCache() {
  memoizedVersion = null;
}

function isRuntimeEntryArray(data: unknown): data is readonly RuntimeEntry[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (r): r is RuntimeEntry =>
      typeof r === "object" &&
      r !== null &&
      typeof (r as Record<string, unknown>)["language"] === "string" &&
      typeof (r as Record<string, unknown>)["version"] === "string"
  );
}

function isPistonExecuteResponse(data: unknown): data is PistonExecuteResponse {
  if (typeof data !== "object" || data === null) return false;
  const rec = data as Record<string, unknown>;
  if (typeof rec["run"] !== "object" || rec["run"] === null) return false;
  const run = rec["run"] as Record<string, unknown>;
  if (
    typeof run["code"] !== "number" &&
    run["code"] !== null &&
    run["code"] !== undefined
  )
    return false;
  return true;
}

async function getPythonVersion(): Promise<string> {
  if (memoizedVersion) return memoizedVersion;
  try {
    const res = await fetch(`${PISTON_API_URL}/api/v2/runtimes`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      throw new Error(`Runtimes query status: ${res.status}`);
    }
    const data = (await res.json()) as unknown;
    if (!isRuntimeEntryArray(data)) {
      throw new Error("Invalid runtimes format");
    }
    const py = data.find(
      (r) => r.language === "python" || r.language === "python3"
    );
    if (!py) {
      throw new Error("Python runtime not found on Piston");
    }
    memoizedVersion = py.version;
    return py.version;
  } catch (err) {
    throw new Error(
      `Failed to resolve Python runtime: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function runCode(
  code: string,
  input: string,
  timeLimitMs: number
): Promise<PistonResult> {
  let version: string;
  try {
    version = await getPythonVersion();
  } catch (err) {
    return {
      status: "unreachable",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // Set timeout with safety margin on client side, but rely on Piston to enforce execution limits.
  // Add abort controller to terminate long requests.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeLimitMs + 1000);

  try {
    const res = await fetch(`${PISTON_API_URL}/api/v2/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "python",
        version,
        files: [{ content: `${code}\n\n${PYTHON_FUNCTION_HARNESS}` }],
        stdin: input,
        run_timeout: timeLimitMs,
        compile_timeout: 10000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        status: "unreachable",
        message: `Piston execution returned status ${res.status}`,
      };
    }

    const data = (await res.json()) as unknown;
    if (!isPistonExecuteResponse(data)) {
      return {
        status: "unreachable",
        message: "Malformed Piston execute response",
      };
    }

    const run = data.run;
    const stdout = run.stdout || "";
    const stderr = run.stderr || "";
    const exitCode = typeof run.code === "number" ? run.code : 0;
    const signal = run.signal;

    // Check if run was killed by SIGKILL / SIGTERM or timeout signal
    if (
      run.status === "TO" ||
      signal === "SIGKILL" ||
      (run.output && run.output.includes("SIGKILL")) ||
      (run.output && run.output.includes("SIGTERM"))
    ) {
      return {
        status: "timeout",
        message: run.message || "Execution timed out",
      };
    }

    if (run.status === "OL" || run.status === "EL" || run.status === "XX") {
      return {
        status: "runtime_error",
        stderr: run.message || stderr || "Piston execution transport error",
        exitCode,
      };
    }

    // Verify exit code and compile/runtime status
    if (exitCode !== 0) {
      // Python does not compile, but Piston returns non-zero code for runtime exceptions.
      // If compile stage existed and failed, compile_error can be returned.
      if (data.compile && data.compile.code !== 0) {
        return {
          status: "compile_error",
          stderr: data.compile.stderr || stderr,
        };
      }
      return { status: "runtime_error", stderr, exitCode };
    }

    return {
      status: "success",
      stdout,
      stderr,
      exitCode,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      return { status: "timeout", message: "Execution timed out" };
    }
    return {
      status: "unreachable",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
