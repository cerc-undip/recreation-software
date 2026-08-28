import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadSessionForAdmin, jsonData, jsonError } from "@/lib/adminSession";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadSessionForAdmin(request, id);
  if (!loaded.ok) return loaded.response;

  if (loaded.session.status !== "active") {
    return jsonError("Session can only end from active status", 400);
  }

  const session = await prisma.session.update({
    where: { id },
    data: { status: "ended" },
  });

  return jsonData(session);
}

export const dynamic = "force-dynamic";
