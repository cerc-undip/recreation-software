import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env["ADMIN_DEFAULT_USERNAME"] || "admin";
  const adminPassword = process.env["ADMIN_DEFAULT_PASSWORD"] || "admin123";
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // 1. Seed Admin idempotently
  await prisma.admin.upsert({
    where: { username: adminUsername },
    update: { password: hashedPassword },
    create: {
      username: adminUsername,
      password: hashedPassword,
    },
  });

  console.log("Admin user seeded.");

  // 2. Define Problem Fixtures
  const problemsData = [
    {
      id: "prob-even-sum",
      title: "Even Sum",
      description: "Write a program that calculates the sum of all even numbers in a given list of integers.",
      inputFormat: "A single line containing space-separated integers.",
      outputFormat: "A single integer representing the sum of even numbers.",
      constraints: "Numbers can be negative. The list can be empty.",
      sampleInput: "1 2 3 4 5 6",
      sampleOutput: "12",
      starterCode: "def solve(numbers_str):\n    # Write your code here\n    # Read input from standard input\n    pass\n",
      timeLimitMs: 5000,
      points: 100,
      testCases: [
        { input: "1 2 3 4 5 6", expectedOutput: "12", isSample: true },
        { input: "1 3 5", expectedOutput: "0", isSample: false },
        { input: "-2 4 -6 8", expectedOutput: "4", isSample: false },
        { input: "", expectedOutput: "0", isSample: false },
      ],
    },
    {
      id: "prob-palindrome",
      title: "Palindrome Checker",
      description: "Write a program that checks if a string is a palindrome. Ignore casing.",
      inputFormat: "A single string.",
      outputFormat: "True or False.",
      constraints: "The string length is between 1 and 1000. Case insensitive.",
      sampleInput: "racecar",
      sampleOutput: "True",
      starterCode: "def is_palindrome(s):\n    # Write your code here\n    pass\n",
      timeLimitMs: 5000,
      points: 100,
      testCases: [
        { input: "racecar", expectedOutput: "True", isSample: true },
        { input: "Hello", expectedOutput: "False", isSample: false },
        { input: "a", expectedOutput: "True", isSample: false },
        { input: "Madam", expectedOutput: "True", isSample: false },
      ],
    },
    {
      id: "prob-fizzbuzz",
      title: "FizzBuzz",
      description: "Return space-separated FizzBuzz values from 1 to N. For multiples of 3 return Fizz, for multiples of 5 return Buzz, and for multiples of both return FizzBuzz.",
      inputFormat: "A single integer N.",
      outputFormat: "Space-separated strings.",
      constraints: "1 <= N <= 100",
      sampleInput: "5",
      sampleOutput: "1 2 Fizz 4 Buzz",
      starterCode: "def fizzbuzz(n):\n    # Write your code here\n    pass\n",
      timeLimitMs: 5000,
      points: 150,
      testCases: [
        { input: "5", expectedOutput: "1 2 Fizz 4 Buzz", isSample: true },
        { input: "15", expectedOutput: "1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz", isSample: false },
        { input: "1", expectedOutput: "1", isSample: false },
      ],
    },
  ];

  // 3. Seed Problems and Test Cases idempotently
  for (const prob of problemsData) {
    const { testCases, ...problemFields } = prob;

    // Upsert problem
    const seededProblem = await prisma.problem.upsert({
      where: { id: prob.id },
      update: problemFields,
      create: problemFields,
    });

    // Delete existing test cases for this problem to prevent duplicate accumulate
    await prisma.testCase.deleteMany({
      where: { problemId: seededProblem.id },
    });

    // Create fresh test cases
    for (const tc of testCases) {
      await prisma.testCase.create({
        data: {
          problemId: seededProblem.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isSample: tc.isSample,
        },
      });
    }

    console.log(`Problem "${seededProblem.title}" seeded with ${testCases.length} test cases.`);
  }

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
