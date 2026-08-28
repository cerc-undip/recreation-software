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

  // UTF-8 BOM for Excel compatibility
  const bom = "\uFEFF";
  const header = "rank,username,totalScore,problem1Score,problem2Score,problem3Score,lastSubmittedAt,tieBreakTime";
  const rows = board.map((entry, i) => {
    const byProblem: Record<string, number> = {};
    entry.perProblemScores.forEach((p, idx) => {
      byProblem[`problem${idx + 1}`] = p.totalScore;
    });
    const p1 = byProblem["problem1"] ?? 0;
    const p2 = byProblem["problem2"] ?? 0;
    const p3 = byProblem["problem3"] ?? 0;
    const last = entry.earliestFullAcAt?.toISOString() ?? "";
    const tie = entry.earliestFullAcAt?.toISOString() ?? "";
    return [i + 1, entry.username, entry.totalScore, p1, p2, p3, last, tie].join(",");
  });

  const csv = [header, ...rows].join("\r\n");

  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leaderboard-${session.code}.csv"`,
    },
  });
}

export const dynamic = "force-dynamic";
