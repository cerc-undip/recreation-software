import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const code = process.argv[2] ?? "GNZV3B";

async function main() {
  const session = await prisma.session.findUnique({
    where: { code },
    include: { problemLinks: { orderBy: { order: "asc" } } },
  });
  if (!session) throw new Error(`Session ${code} not found`);

  const next = session.currentProblemIndex + 1;
  if (next >= session.problemLinks.length) {
    console.log("Already on last problem");
    return;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { currentProblemIndex: next, currentProblemStartedAt: new Date() },
  });
  console.log(`Moved ${code} to problem ${next + 1}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
