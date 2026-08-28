import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readParticipantBearer } from "@/lib/auth";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const auth = await readParticipantBearer(request.headers.get("authorization") ?? undefined, env.JWT_SECRET);
  if (!auth.success) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const session = await prisma.session.findUnique({
    where: { id: auth.data.sessionId },
    select: {
      id: true,
      code: true,
      status: true,
      currentProblemIndex: true,
      currentProblemStartedAt: true,
      problemLinks: { select: { id: true, order: true, problemId: true } },
    },
  });

  if (!session) return Response.json({ success: false, error: "Session not found" }, { status: 404 });

  const problemLinks = [...session.problemLinks].sort((a, b) => a.order - b.order);
  const currentLink = problemLinks[session.currentProblemIndex] ?? null;

  return Response.json({
    success: true,
    data: {
      sessionId: session.id,
      code: session.code,
      status: session.status,
      currentProblemIndex: session.currentProblemIndex,
      currentProblemId: currentLink?.problemId ?? null,
      totalProblems: problemLinks.length,
      currentProblemStartedAt: session.currentProblemStartedAt,
    },
  });
}

export const dynamic = "force-dynamic";
