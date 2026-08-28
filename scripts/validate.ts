/**
 * Validation script: checks all API endpoints and database constraints.
 * Requires dev server on http://127.0.0.1:3000 and a seeded database.
 * Usage: pnpm tsx scripts/validate.ts
 */
import { PrismaClient } from "@prisma/client";
import { createParticipantToken } from "../lib/auth";
import { env } from "../lib/env";

const prisma = new PrismaClient();
const BASE = "http://127.0.0.1:3000";

const results: { name: string; status: "PASS" | "FAIL"; details?: string }[] = [];

function assert(name: string, condition: boolean, details?: string) {
  results.push({ name, status: condition ? "PASS" : "FAIL", ...(details !== undefined ? { details } : {}) });
  console.log(`[${condition ? "PASS" : "FAIL"}] ${name}${details ? ` — ${details}` : ""}`);
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init);
  let body: unknown = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { res, body: body as { success?: boolean; data?: { status?: string }; error?: string } | null };
}

async function main() {
  console.log("=== API Endpoint Validation ===");

  // 1. Admin login (bad credentials rejected)
  const badLogin = await api("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: env.ADMIN_DEFAULT_USERNAME, password: "wrong" }),
  });
  assert("Admin login rejects bad password", badLogin.res.status === 401);

  // 2. Admin login (good credentials)
  const login = await api("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: env.ADMIN_DEFAULT_USERNAME, password: env.ADMIN_DEFAULT_PASSWORD }),
  });
  assert("Admin login succeeds", login.res.status === 200 && login.body?.success === true);
  const adminCookie = login.res.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert("Admin cookie issued", adminCookie.length > 0);

  // 3. Admin protected route requires cookie
  const noAuth = await api("/api/admin/protected");
  assert("Admin protected route rejects no cookie", noAuth.res.status === 401);

  const protectedOk = await api("/api/admin/protected", { headers: { Cookie: adminCookie } });
  assert("Admin protected route accepts cookie", protectedOk.res.status === 200);

  // 4. Participant endpoints reject missing/invalid bearer
  const noBearer = await api("/api/session/state");
  assert("Session state rejects no bearer", noBearer.res.status === 401);

  const badBearer = await api("/api/session/state", { headers: { Authorization: "Bearer garbage" } });
  assert("Session state rejects invalid bearer", badBearer.res.status === 401);

  // 5. Join with wrong session code
  const badJoin = await api("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionCode: "ZZZZZZ", username: "nobody" }),
  });
  assert("Join rejects unknown session code", badJoin.res.status === 404 || badJoin.res.status === 400);

  // 6. Database constraints
  console.log("\n=== Database Constraint Validation ===");
  const problems = await prisma.problem.findMany({ include: { testCases: true } });
  assert("Three problems seeded", problems.length === 3, `count=${problems.length}`);
  assert(
    "All problems have test cases",
    problems.every((p) => p.testCases.length > 0),
    problems.map((p) => p.testCases.length).join(",")
  );
  assert(
    "Each problem has at least one sample test case",
    problems.every((p) => p.testCases.some((t) => t.isSample))
  );

  const admin = await prisma.admin.findUnique({ where: { username: env.ADMIN_DEFAULT_USERNAME } });
  assert("Admin user exists", admin !== null);

  // Token round-trip: mint a token and verify it parses via API
  const session = await prisma.session.findFirst({ where: { status: "active" } });
  if (session) {
    const participant = await prisma.participant.findFirst({ where: { sessionId: session.id } });
    if (participant) {
      const token = await createParticipantToken(
        { participantId: participant.id, sessionId: session.id },
        env.JWT_SECRET
      );
      const state = await api("/api/session/state", { headers: { Authorization: `Bearer ${token}` } });
      assert(
        "Participant token round-trip via /api/session/state",
        state.res.status === 200 && state.body?.success === true,
        `status=${state.body?.data?.status}`
      );
    }
  } else {
    console.log("[SKIP] No active session for token round-trip test");
  }

  // Unique constraint: duplicate (sessionId, username) must fail
  const anySession = await prisma.session.findFirst();
  if (anySession) {
    const dup = await prisma.participant.findFirst({ where: { sessionId: anySession.id } });
    if (dup) {
      let rejected = false;
      try {
        await prisma.participant.create({ data: { username: dup.username, sessionId: anySession.id } });
      } catch {
        rejected = true;
      }
      assert("Unique(sessionId, username) constraint enforced", rejected);
    }
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  const failed = results.filter((r) => r.status === "FAIL");
  console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log(JSON.stringify(failed, null, 2));
    process.exitCode = 1;
  } else {
    console.log("ALL CHECKS PASSED");
  }
}

main()
  .catch((e) => {
    console.error("Validation crashed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
