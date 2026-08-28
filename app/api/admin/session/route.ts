import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth";
import { jsonData, jsonError } from "@/lib/adminSession";

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Deterministic order for the seeded fixture problems (PRD 4.1: soal #1..#3).
const SEED_PROBLEM_ORDER = ["prob-even-sum", "prob-palindrome", "prob-fizzbuzz"];

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function generateSessionCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = randomCode();
    const existing = await prisma.session.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique session code");
}

export async function POST(request: NextRequest) {
  const admin = await getAdminFromCookie(request);
  if (!admin.success) return Response.json(admin, { status: 401 });

  const problems = await prisma.problem.findMany();
  if (problems.length === 0) {
    return jsonError("No problems seeded", 400);
  }

  const ordered = [...problems].sort((a, b) => {
    const ia = SEED_PROBLEM_ORDER.indexOf(a.id);
    const ib = SEED_PROBLEM_ORDER.indexOf(b.id);
    if (ia === -1 && ib === -1) return a.id.localeCompare(b.id);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const code = await generateSessionCode();

  const session = await prisma.session.create({
    data: {
      code,
      status: "waiting",
      currentProblemIndex: 0,
      problemLinks: {
        create: ordered.map((problem, order) => ({ problemId: problem.id, order })),
      },
    },
    include: { problemLinks: { include: { problem: true } } },
  });

  return jsonData(session);
}

export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie(request);
  if (!admin.success) return Response.json(admin, { status: 401 });

  const sessions = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { participants: true, problemLinks: { include: { problem: true } } },
  });

  return jsonData(sessions);
}

export const dynamic = "force-dynamic";
