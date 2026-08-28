import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BASE_ENV = {
  DATABASE_URL: "file:./dev.db",
  JWT_SECRET: "a-secure-secret-key-that-is-long-enough-1234567890",
  ADMIN_DEFAULT_USERNAME: "admin",
  ADMIN_DEFAULT_PASSWORD: "adminpassword123",
  PISTON_API_URL: "http://localhost:2000",
};

describe("env validation", () => {
  const original = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...original, ...BASE_ENV };
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("accepts a fully configured environment", async () => {
    const mod = await import("./env");
    expect(mod.env.JWT_SECRET).toBe(BASE_ENV.JWT_SECRET);
  });

  it("throws a clear error when JWT_SECRET is missing", async () => {
    delete process.env["JWT_SECRET"];
    await expect(import("./env")).rejects.toThrow(/Invalid environment variables/);
  });

  it("throws a clear error when JWT_SECRET is shorter than 32 chars", async () => {
    process.env["JWT_SECRET"] = "too-short";
    await expect(import("./env")).rejects.toThrow(/Invalid environment variables/);
  });
});
