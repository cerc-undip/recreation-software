import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readParticipantBearer } from "@/lib/auth";
import { env } from "@/lib/env";
import { computeLeaderboard, SubmissionRecord } from "@/lib/scoring";

export async function GET(request: NextRequest) {
  const auth = await readParticipantBearer(request.headers.get("authorization") ?? undefined, env.JWT_SECRET);
  if (!auth.success) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const session = await prisma.session.findUnique({
    where: { id: auth.data.sessionId },
    include: {
      problemLinks: { include: { problem: true }, orderBy: { order: "asc" } },
    },
  });
  if (!session) return Response.json({ success: false, error: "Session not found" }, { status: 404 });

  const rawSubs = await prisma.submission.findMany({
    where: { sessionId: session.id },
    include: { participant: true, problem: true },
  });

  const records: SubmissionRecord[] = rawSubs.map((s) => ({
    id: s.id,
    userId: s.participantId,
    username: s.participant.username,
    problemId: s.problemId,
    sessionId: s.sessionId!,
    isRunOnly: s.isRunOnly,
    status: s.status as SubmissionRecord["status"],
    passedCases: s.testCasesPassed,
    totalCases: s.totalTestCases,
    problemPoints: s.problem.points,
    submittedAt: s.submittedAt,
  }));

  const board = computeLeaderboard(records);

  return Response.json({
    success: true,
    data: {
      leaderboard: board,
      problems: session.problemLinks.map((l) => ({ id: l.problemId, title: l.problem.title })),
    },
  });
}

export const dynamic = "force-dynamic";
