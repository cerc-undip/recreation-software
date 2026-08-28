import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  ADMIN_DEFAULT_USERNAME: z.string().min(1, "ADMIN_DEFAULT_USERNAME is required"),
  ADMIN_DEFAULT_PASSWORD: z.string().min(1, "ADMIN_DEFAULT_PASSWORD is required"),
  PISTON_API_URL: z.string().url("PISTON_API_URL must be a valid URL"),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

export const env = validateEnv();
