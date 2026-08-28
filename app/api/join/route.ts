import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createParticipantToken } from "@/lib/auth";
import { env } from "@/lib/env";

const joinSchema = z.object({
  sessionCode: z.string().trim().toUpperCase(),
  username: z.string().trim(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, error: "Invalid input" }, { status: 400 });
  }

  const { sessionCode, username } = parsed.data;

  const session = await prisma.session.findUnique({
    where: { code: sessionCode },
  });

  if (!session) {
    return Response.json({ success: false, error: "Session not found" }, { status: 404 });
  }

  const participant = await prisma.participant.findUnique({
    where: { sessionId_username: { sessionId: session.id, username } },
  });

  if (participant?.isBlacklisted) {
    return Response.json({ success: false, error: "Username is blacklisted" }, { status: 403 });
  }

  // No pre-existing row → anyone may join (self-registration); create one.
  const target = participant ?? (await prisma.participant.create({ data: { sessionId: session.id, username } }));

  const token = await createParticipantToken(
    { participantId: target.id, sessionId: session.id },
    env.JWT_SECRET
  );

  await prisma.participant.update({
    where: { id: target.id },
    data: {
      token,
      joinedAt: new Date(),
      isActive: true,
      lastSeenAt: new Date(),
    },
  });

  return Response.json({ success: true, data: { token } });
}
