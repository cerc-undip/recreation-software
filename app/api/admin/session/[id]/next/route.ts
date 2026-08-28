import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadSessionForAdmin, jsonData, jsonError } from "@/lib/adminSession";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadSessionForAdmin(request, id);
  if (!loaded.ok) return loaded.response;

  if (loaded.session.status !== "active") {
    return jsonError("Session is not active", 400);
  }

  const nextIndex = loaded.session.currentProblemIndex + 1;
  if (nextIndex >= loaded.session.problemCount) {
    return jsonError("Already on the last problem; end the session instead", 400);
  }

  const session = await prisma.session.update({
    where: { id },
    data: { currentProblemIndex: nextIndex, currentProblemStartedAt: new Date() },
  });

  return jsonData(session);
}

export const dynamic = "force-dynamic";
