import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    passWithNoTests: true,
    env: {
      DATABASE_URL: "file:./dev.db",
      JWT_SECRET: "test-secret-key-that-is-at-least-32-characters",
      ADMIN_DEFAULT_USERNAME: "admin",
      ADMIN_DEFAULT_PASSWORD: "admin",
      PISTON_API_URL: "http://localhost:2000"
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
});
