import { createHmac, timingSafeEqual } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Typed auth boundaries: Admin password (bcryptjs) + signed admin cookie and
 * participant bearer token (HMAC-SHA256 JWT-style payload + signature).
 * No NextAuth, no participant passwords.
 */

export const ADMIN_COOKIE_NAME = "codearena_admin";

export type AuthResult<T> = { success: true; data: T } | { success: false; error: string };

export const unauthorized: AuthResult<never> = { success: false, error: "Unauthorized" };

const adminTokenPayload = z.object({
  sub: z.string(),
  kind: z.literal("admin"),
  iat: z.number(),
  exp: z.number(),
});
type AdminTokenPayload = z.infer<typeof adminTokenPayload>;

const participantTokenPayload = z.object({
  sub: z.string(),
  kind: z.literal("participant"),
  sessionId: z.string(),
  iat: z.number(),
  exp: z.number(),
});
type ParticipantTokenPayload = z.infer<typeof participantTokenPayload>;

const TOKEN_TTL_S = 60 * 60 * 12; // 12h

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function verifySignature(data: string, sig: string, secret: string): boolean {
  const expected = sign(data, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 10);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return compare(plain, hashed);
}

export async function createAdminToken(adminId: string, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = {
    sub: adminId,
    kind: "admin",
    iat: now,
    exp: now + TOKEN_TTL_S,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export async function readAdminToken(token: string, secret: string): Promise<AuthResult<{ adminId: string }>> {
  const parsed = parseSigned(adminTokenPayload, token, secret);
  if (!parsed.ok) return unauthorized;
  return { success: true, data: { adminId: parsed.value.sub } };
}

export async function getAdminFromCookie(
  request: NextRequest,
): Promise<AuthResult<{ adminId: string }>> {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return unauthorized;
  return readAdminToken(token, env.JWT_SECRET);
}

export async function createParticipantToken(
  payload: { participantId: string; sessionId: string },
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload: ParticipantTokenPayload = {
    sub: payload.participantId,
    kind: "participant",
    sessionId: payload.sessionId,
    iat: now,
    exp: now + TOKEN_TTL_S,
  };
  const body = b64url(JSON.stringify(tokenPayload));
  return `${body}.${sign(body, secret)}`;
}

export async function readParticipantBearer(
  header: string | undefined,
  secret: string,
): Promise<AuthResult<{ participantId: string; sessionId: string }>> {
  if (!header || !header.startsWith("Bearer ")) return unauthorized;
  const raw = header.slice("Bearer ".length).trim();
  if (!raw) return unauthorized;
  const parsed = parseSigned(participantTokenPayload, raw, secret);
  if (!parsed.ok) return unauthorized;
  return { success: true, data: { participantId: parsed.value.sub, sessionId: parsed.value.sessionId } };
}

function parseSigned<T extends { readonly exp: number; readonly iat: number }>(
  schema: z.ZodType<T>,
  raw: string,
  secret: string,
): { ok: true; value: T } | { ok: false } {
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return { ok: false };
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!verifySignature(body, sig, secret)) return { ok: false };

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) return { ok: false };

  const now = Math.floor(Date.now() / 1000);
  if (parsed.data.exp <= now || parsed.data.iat > now) return { ok: false };
  return { ok: true, value: parsed.data };
}
