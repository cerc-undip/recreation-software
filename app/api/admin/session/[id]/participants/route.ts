import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loadSessionForAdmin, jsonData, jsonError } from "@/lib/adminSession";

const bodySchema = z.object({
  usernames: z.array(z.string().trim().min(1).max(50)).min(1).optional(),
  text: z.string().min(1).optional(),
});

/**
 * Extract usernames from any of: JSON array, newline-pasted text, or CSV text
 * (username column, header row skipped). Dedupes while preserving order.
 */
function extractUsernames(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const lines = raw.split(/\r?\n/);

  // Skip a CSV header row like "username" or "id,username".
  const first = lines[0];
  if (first !== undefined && /username/i.test(first) && !/^\s*\d+\s*$/.test(first)) {
    lines.shift();
  }

  for (const line of lines) {
    for (const cell of line.split(",")) {
      const name = cell.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    }
  }
  return out;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadSessionForAdmin(request, id);
  if (!loaded.ok) return loaded.response;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Provide usernames (array) or text (newline/CSV)", 400);
  }

  let usernames: string[];
  if (parsed.data.usernames) {
    usernames = [...new Set(parsed.data.usernames)];
  } else {
    usernames = extractUsernames(parsed.data.text!);
  }

  if (usernames.length === 0) {
    return jsonError("No valid usernames provided", 400);
  }

  const existing = await prisma.participant.findMany({
    where: { sessionId: id, username: { in: usernames } },
    select: { username: true },
  });
  if (existing.length > 0) {
    const names = existing.map((e) => e.username).join(", ");
    return jsonError(`Duplicate username(s) already blacklisted: ${names}`, 409);
  }

  const created = await prisma.participant.createManyAndReturn({
    data: usernames.map((username) => ({ sessionId: id, username, isBlacklisted: true })),
  });

  return jsonData({ added: created.length, participants: created });
}

export const dynamic = "force-dynamic";
