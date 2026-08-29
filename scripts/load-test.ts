import { PrismaClient } from "@prisma/client";
import { createParticipantToken } from "../lib/auth";
import { env } from "../lib/env";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting load test...");
  
  const sessionCode = process.argv[2] ?? "GNZV3B";
  const session = await prisma.session.findUnique({
    where: { code: sessionCode },
    include: { problemLinks: { orderBy: { order: "asc" }, include: { problem: true } } }
  });

  if (!session) {
    console.log(`Session ${sessionCode} not found.`);
    return;
  }
  if (session.status !== "active") {
    console.log(`Session ${sessionCode} is ${session.status}. Start it before load testing submissions.`);
    return;
  }

  const currentProblem = session.problemLinks[session.currentProblemIndex]?.problem;
  if (!currentProblem) {
    console.log("No current problem found.");
    return;
  }

  console.log(`Targeting session ${session.id}, problem ${currentProblem.id}`);

  const participants = await prisma.participant.findMany({
    where: { sessionId: session.id },
    take: 150
  });

  if (participants.length < 150) {
    console.log(`Only ${participants.length} participants found. Creating ${150 - participants.length} more...`);
    const needed = 150 - participants.length;
    const newParticipants = Array.from({ length: needed }).map((_, i) => ({
      username: `load_test_user_${Date.now()}_${i}`,
      sessionId: session.id,
      token: null, // token set after create via createParticipantToken
      isActive: true,
      lastSeenAt: new Date()
    }));
    await prisma.participant.createMany({ data: newParticipants });
    // Fetch the new participants (need their ids to mint tokens)
    const newRows = await prisma.participant.findMany({
      where: { sessionId: session.id, token: null },
      take: needed
    });
    for (const row of newRows) {
      const token = await createParticipantToken(
        { participantId: row.id, sessionId: session.id },
        env.JWT_SECRET
      );
      await prisma.participant.update({ where: { id: row.id }, data: { token } });
    }
    console.log("Created missing participants.");
  }

  const allParticipants = await prisma.participant.findMany({
    where: { sessionId: session.id },
    take: 150
  });

  for (const p of allParticipants) {
    if (!p.token || p.token.startsWith("load_test_token_")) {
      const token = await createParticipantToken(
        { participantId: p.id, sessionId: session.id },
        env.JWT_SECRET
      );
      await prisma.participant.update({ where: { id: p.id }, data: { token } });
      p.token = token;
    }
  }

  console.log(`Simulating ${allParticipants.length} concurrent submissions...`);

  const codeByProblem: Record<string, string> = {
    "prob-even-sum": `def solve(numbers_str):
    nums = [int(x) for x in numbers_str.split()]
    return sum(x for x in nums if x % 2 == 0)
`,
    "prob-palindrome": `def is_palindrome(s):
    s = s.strip().lower()
    return str(s == s[::-1])
`,
    "prob-fizzbuzz": `def fizzbuzz(n):
    n = int(n.strip())
    out = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            out.append("FizzBuzz")
        elif i % 3 == 0:
            out.append("Fizz")
        elif i % 5 == 0:
            out.append("Buzz")
        else:
            out.append(str(i))
    return " ".join(out)
`,
  };
  const code = codeByProblem[currentProblem.id] ?? `import sys
print(sys.stdin.read().strip())
`;

  const start = Date.now();

  const promises = allParticipants.map(async (p) => {
    try {
      const res = await fetch("http://127.0.0.1:3000/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${p.token}`
        },
        body: JSON.stringify({
          problemId: currentProblem.id,
          code,
          isRunOnly: false
        })
      });
      const data = await res.json();
      return { success: data.success, status: data.data?.status, error: data.error };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
  });

  const results = await Promise.all(promises);
  const duration = Date.now() - start;

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nLoad test completed in ${duration}ms`);
  console.log(`Total submissions: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log("\nSample errors:");
    console.log(results.filter(r => !r.success).slice(0, 5).map(r => r.error));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
