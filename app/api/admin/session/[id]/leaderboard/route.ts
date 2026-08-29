import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth";
import { computeLeaderboard, SubmissionRecord } from "@/lib/scoring";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookie(request);
  if (!admin.success) return Response.json(admin, { status: 401 });

  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      problemLinks: { include: { problem: true }, orderBy: { order: "asc" } },
    },
  });
  if (!session) return Response.json({ success: false, error: "Session not found" }, { status: 404 });

  const rawSubs = await prisma.submission.findMany({
    where: { sessionId: session.id },
    include: { participant: true, problem: true },
  });

  const records: SubmissionRecord[] = rawSubs.map((s: any) => ({
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
      problems: session.problemLinks.map((l: any) => ({ id: l.problemId, title: l.problem.title })),
    },
  });
}

export const dynamic = "force-dynamic";
