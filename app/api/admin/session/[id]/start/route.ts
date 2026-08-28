import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadSessionForAdmin, jsonData, jsonError } from "@/lib/adminSession";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadSessionForAdmin(request, id);
  if (!loaded.ok) return loaded.response;

  if (loaded.session.status !== "waiting") {
    return jsonError("Session can only start from waiting status", 400);
  }
  if (loaded.session.problemCount === 0) {
    return jsonError("Session has no assigned problems", 400);
  }

  const session = await prisma.session.update({
    where: { id },
    data: { status: "active", currentProblemIndex: 0, currentProblemStartedAt: new Date() },
  });

  return jsonData(session);
}

export const dynamic = "force-dynamic";
