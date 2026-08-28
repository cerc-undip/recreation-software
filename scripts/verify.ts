import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  console.log("=== Database Constraints Verification ===");
  const results: { name: string; status: "PASS" | "FAIL"; details?: string }[] = [];

  // Helper to push results
  const assertTest = (name: string, condition: boolean, details?: string) => {
    const entry: { name: string; status: "PASS" | "FAIL"; details?: string } = {
      name,
      status: condition ? "PASS" : "FAIL",
    };
    if (details !== undefined) {
      entry.details = details;
    }
    results.push(entry);
    console.log(`[${condition ? "PASS" : "FAIL"}] ${name}`);
  };

  try {
    // 1. Verify seeded admin exists
    const admin = await prisma.admin.findUnique({
      where: { username: process.env["ADMIN_DEFAULT_USERNAME"] || "admin" },
    });
    assertTest("Admin seeded successfully", admin !== null, `Username: ${admin?.username ?? ""}`);

    // 2. Verify problems and test cases seeded
    const problems = await prisma.problem.findMany({
      include: { testCases: true },
    });
    assertTest("Three problems seeded", problems.length === 3, `Count: ${problems.length}`);
    const allTestCasesCount = problems.reduce((acc, p) => acc + p.testCases.length, 0);
    assertTest("Problems have test cases", allTestCasesCount === 11, `Test cases count: ${allTestCasesCount}`);

    const firstProblem = problems[0];
    if (!firstProblem || !firstProblem.testCases[0]) {
      throw new Error("No problem or test case found in seeded data.");
    }
    const firstTestCase = firstProblem.testCases[0];

    // 3. Verify nullable participant token & presence metadata on participant whitelist
    // Create a temporary session
    const tempSession = await prisma.session.create({
      data: {
        code: "TEST12",
        status: "waiting",
      },
    });

    // Create participant with token: null (whitelist row)
    const participant = await prisma.participant.create({
      data: {
        username: "test_whitelist_user",
        sessionId: tempSession.id,
        token: null, // Nullable token allowed
        isActive: false,
      },
    });

    assertTest(
      "Participant token is nullable for whitelist row",
      participant.token === null,
      `Token: ${String(participant.token)}`
    );
    assertTest(
      "Participant presence default isActive is false",
      participant.isActive === false,
      `isActive: ${String(participant.isActive)}`
    );

    // 4. Verify TestCaseResult and Submission model constraints
    // Create a dummy submission
    const submission = await prisma.submission.create({
      data: {
        sessionId: tempSession.id,
        participantId: participant.id,
        problemId: firstProblem.id,
        code: "print('hello')",
        status: "AC",
        score: 100,
        testCasesPassed: 1,
        totalTestCases: 1,
        isRunOnly: false,
      },
    });

    const testCaseResult = await prisma.testCaseResult.create({
      data: {
        submissionId: submission.id,
        testCaseId: firstTestCase.id,
        status: "AC",
        durationMs: 42,
        actualOutput: "hello\n",
        isSample: true,
        isRunOnly: false,
      },
    });

    assertTest(
      "TestCaseResult relation and fields verify correctly",
      testCaseResult !== null &&
        testCaseResult.durationMs === 42 &&
        testCaseResult.actualOutput === "hello\n" &&
        testCaseResult.isSample === true &&
        testCaseResult.isRunOnly === false,
      `TestCaseResult: ${JSON.stringify(testCaseResult)}`
    );

    // 5. Verify AuditRecord constraints
    const audit = await prisma.auditRecord.create({
      data: {
        action: "session.create",
        actorType: "admin",
        actorId: admin?.id ?? null,
        targetType: "Session",
        targetId: tempSession.id,
        detail: "Created test session",
      },
    });

    assertTest("Audit Record created successfully", audit !== null, `Action: ${audit.action}`);

    // Clean up temporary records
    await prisma.session.delete({
      where: { id: tempSession.id },
    });

    console.log("Cleanup completed.");

  } catch (error) {
    console.error("Verification failed with error:", error);
    assertTest("Verification run completed without runtime crashes", false, String(error));
  } finally {
    await prisma.$disconnect();
  }

  // Output summary
  console.log("\n=== SUMMARY ===");
  const allPassed = results.every((r) => r.status === "PASS");
  console.log(allPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED");

  // Output detailed JSON to stdout for capture
  console.log(JSON.stringify(results, null, 2));

  if (!allPassed) {
    process.exit(1);
  }
}

run();
