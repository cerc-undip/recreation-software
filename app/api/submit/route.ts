import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readParticipantBearer } from "@/lib/auth";
import { env } from "@/lib/env";
import { runCode } from "@/lib/piston";
import { compareOutputs } from "@/lib/scoring";

const submitSchema = z.object({
  problemId: z.string().min(1),
  code: z.string().min(1).max(100_000),
  isRunOnly: z.boolean().default(false),
});

type CaseStatus = "AC" | "WA" | "TLE" | "RE" | "CE";

export async function POST(request: NextRequest) {
  const auth = await readParticipantBearer(request.headers.get("authorization") ?? undefined, env.JWT_SECRET);
  if (!auth.success) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, error: "Invalid input" }, { status: 400 });

  const { problemId, code, isRunOnly } = parsed.data;

  const session = await prisma.session.findUnique({
    where: { id: auth.data.sessionId },
    include: { problemLinks: { orderBy: { order: "asc" } } },
  });
  if (!session) return Response.json({ success: false, error: "Session not found" }, { status: 404 });
  if (session.status !== "active") {
    return Response.json({ success: false, error: "Session is not active" }, { status: 409 });
  }

  const currentLink = session.problemLinks[session.currentProblemIndex];
  if (!currentLink || currentLink.problemId !== problemId) {
    return Response.json({ success: false, error: "Problem is not the current active problem" }, { status: 409 });
  }

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    include: { testCases: true },
  });
  if (!problem) return Response.json({ success: false, error: "Problem not found" }, { status: 404 });

  const cases = isRunOnly
    ? problem.testCases.filter((t) => t.isSample)
    : problem.testCases;

  if (cases.length === 0) {
    return Response.json({ success: false, error: "No test cases available" }, { status: 500 });
  }

  // Execute all cases through Piston (no DB writes during execution)
  const results = await Promise.all(
    cases.map(async (tc) => {
      const result = await runCode(code, tc.input, problem.timeLimitMs);
      let status: CaseStatus;
      let actualOutput: string | null = null;
      const durationMs: number | null = null;

      switch (result.status) {
        case "success":
          actualOutput = result.stdout;
          status = compareOutputs(result.stdout, tc.expectedOutput) ? "AC" : "WA";
          break;
        case "compile_error":
          status = "CE";
          actualOutput = result.stderr;
          break;
        case "runtime_error":
          status = "RE";
          actualOutput = result.stderr;
          break;
        case "timeout":
          status = "TLE";
          break;
        default:
          status = "RE";
          actualOutput = result.message;
      }
      return { testCaseId: tc.id, status, actualOutput, durationMs, isSample: tc.isSample };
    })
  );

  const passed = results.filter((r) => r.status === "AC").length;
  const overall: CaseStatus = results.every((r) => r.status === "AC")
    ? "AC"
    : results.some((r) => r.status === "TLE")
      ? "TLE"
      : results.some((r) => r.status === "CE")
        ? "CE"
        : results.some((r) => r.status === "RE")
          ? "RE"
          : "WA";

  // Persist after execution (SQLite-friendly)
  const submission = await prisma.submission.create({
    data: {
      sessionId: session.id,
      participantId: auth.data.participantId,
      problemId,
      code,
      status: overall,
      score: 0, // score computed by leaderboard aggregation
      testCasesPassed: passed,
      totalTestCases: cases.length,
      executionTimeMs: null,
      isRunOnly,
      testCaseResults: {
        create: results.map((r) => ({
          testCaseId: r.testCaseId,
          status: r.status,
          durationMs: r.durationMs,
          actualOutput: r.actualOutput,
          isSample: r.isSample,
          isRunOnly,
        })),
      },
    },
  });

  // Response: never expose hidden expected outputs
  return Response.json({
    success: true,
    data: {
      submissionId: submission.id,
      status: overall,
      testCasesPassed: passed,
      totalTestCases: cases.length,
      isRunOnly,
      results: results.map((r) => ({
        testCaseId: r.testCaseId,
        status: r.status,
        isSample: r.isSample,
        actualOutput: r.isSample || r.status !== "AC" ? r.actualOutput : null,
      })),
    },
  });
}

export const dynamic = "force-dynamic";
