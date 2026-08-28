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
      status: true,
      currentProblemIndex: true,
      problemLinks: {
        orderBy: { order: "asc" },
        include: { problem: true },
      },
    },
  });

  if (!session) return Response.json({ success: false, error: "Session not found" }, { status: 404 });
  if (session.status !== "active") {
    return Response.json({ success: true, data: { problem: null, status: session.status } });
  }

  const currentLink = session.problemLinks[session.currentProblemIndex];
  if (!currentLink) return Response.json({ success: true, data: { problem: null, status: session.status } });

  return Response.json({
    success: true,
    data: {
      status: session.status,
      problem: {
        id: currentLink.problem.id,
        title: currentLink.problem.title,
        description: currentLink.problem.description,
        inputFormat: currentLink.problem.inputFormat,
        outputFormat: currentLink.problem.outputFormat,
        constraints: currentLink.problem.constraints,
        sampleInput: currentLink.problem.sampleInput,
        sampleOutput: currentLink.problem.sampleOutput,
        starterCode: currentLink.problem.starterCode,
        timeLimitMs: currentLink.problem.timeLimitMs,
        points: currentLink.problem.points,
      },
    },
  });
}

export const dynamic = "force-dynamic";
