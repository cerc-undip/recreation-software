import { describe, it, expect } from "vitest";
import {
  scoreProblem,
  compareOutputs,
  firstFullAcBonus,
  aggregateTotal,
  computeLeaderboard,
  type SubmissionRecord,
  type PerProblemScore,
} from "./scoring";

const T1 = new Date("2026-08-29T10:00:00Z");
const T2 = new Date("2026-08-29T10:05:00Z");

const baseSub = (overrides: Partial<SubmissionRecord>): SubmissionRecord => ({
  id: "s1",
  userId: "u1",
  username: "Alice",
  problemId: "p1",
  sessionId: "sess1",
  isRunOnly: false,
  status: "AC",
  passedCases: 10,
  totalCases: 10,
  problemPoints: 100,
  submittedAt: T1,
  ...overrides,
});

describe("Scoring logic (lib/scoring.ts)", () => {
  describe("scoreProblem", () => {
    it("handles total=0 guard by returning 0", () => {
      expect(scoreProblem(0, 0, 100)).toBe(0);
      expect(scoreProblem(5, 0, 100)).toBe(0);
    });

    it("computes 0/full/partial credit via Math.round((passed/total)*points)", () => {
      expect(scoreProblem(0, 10, 100)).toBe(0);
      expect(scoreProblem(10, 10, 100)).toBe(100);
      expect(scoreProblem(5, 10, 100)).toBe(50);
      expect(scoreProblem(1, 3, 100)).toBe(33); // Math.round(33.333)
      expect(scoreProblem(2, 3, 100)).toBe(67); // Math.round(66.666)
    });
  });

  describe("compareOutputs", () => {
    it("compares after trimming trailing whitespace per line and trailing newlines", () => {
      expect(compareOutputs("hello \nworld   \n\n", "hello\nworld")).toBe(true);
      expect(compareOutputs("1 2 3\t \n", "1 2 3")).toBe(true);
      expect(compareOutputs("foo\nbar", "foo\nbar\n\n\n")).toBe(true);
      expect(compareOutputs("foo  bar", "foo bar")).toBe(false);
      expect(compareOutputs("hello\n", "world\n")).toBe(false);
    });
  });

  describe("firstFullAcBonus", () => {
    it("calculates flat 10% rounded via Math.round(points * 0.10)", () => {
      expect(firstFullAcBonus(100)).toBe(10);
      expect(firstFullAcBonus(55)).toBe(6); // Math.round(5.5)
      expect(firstFullAcBonus(45)).toBe(5); // Math.round(4.5)
      expect(firstFullAcBonus(0)).toBe(0);
    });
  });

  describe("aggregateTotal", () => {
    it("sums best score per problem including bonus", () => {
      const scores: PerProblemScore[] = [
        { problemId: "p1", baseScore: 100, bonusScore: 10, totalScore: 110, isFullAc: true },
        { problemId: "p2", baseScore: 50, bonusScore: 0, totalScore: 50, isFullAc: false },
      ];
      expect(aggregateTotal(scores)).toBe(160);
    });

    it("returns 0 for empty scores array", () => {
      expect(aggregateTotal([])).toBe(0);
    });
  });

  describe("computeLeaderboard", () => {
    it("handles empty leaderboard", () => {
      expect(computeLeaderboard([])).toEqual([]);
    });

    it("excludes isRunOnly submissions entirely from scores and leaderboard", () => {
      const submissions: SubmissionRecord[] = [
        baseSub({ id: "sub1", isRunOnly: true, status: "AC" }),
      ];
      expect(computeLeaderboard(submissions)).toEqual([]);
    });

    it("awards bonus ONLY to the earliest full-AC submission per (session, problem) and not to later full-ACs", () => {
      const submissions: SubmissionRecord[] = [
        baseSub({
          id: "s2",
          userId: "u2",
          username: "Bob",
          problemId: "p1",
          sessionId: "sess1",
          isRunOnly: false,
          status: "AC",
          submittedAt: T2,
        }),
        baseSub({
          id: "s1",
          userId: "u1",
          username: "Alice",
          problemId: "p1",
          sessionId: "sess1",
          isRunOnly: false,
          status: "AC",
          submittedAt: T1,
        }),
      ];

      const board = computeLeaderboard(submissions);
      expect(board).toHaveLength(2);

      const alice = board.find((e) => e.username === "Alice");
      const bob = board.find((e) => e.username === "Bob");
      expect(alice).toBeDefined();
      expect(bob).toBeDefined();

      // Alice: earliest full-AC -> base 100 + 10% bonus = 110
      expect(alice?.totalScore).toBe(110);
      expect(alice?.perProblemScores).toEqual([
        { problemId: "p1", baseScore: 100, bonusScore: 10, totalScore: 110, isFullAc: true },
      ]);
      expect(alice?.earliestFullAcAt).toEqual(T1);

      // Bob: later full-AC -> base 100 + no bonus = 100
      expect(bob?.totalScore).toBe(100);
      expect(bob?.perProblemScores).toEqual([
        { problemId: "p1", baseScore: 100, bonusScore: 0, totalScore: 100, isFullAc: true },
      ]);
      expect(bob?.earliestFullAcAt).toEqual(T2);
    });

    it("scores 0 for all non-AC statuses (WA/TLE/RE/CE/PENDING)", () => {
      const submissions: SubmissionRecord[] = [
        baseSub({ id: "s1", userId: "u1", username: "Alice", problemId: "p1", status: "WA", submittedAt: T1 }),
        baseSub({ id: "s2", userId: "u1", username: "Alice", problemId: "p2", status: "TLE", submittedAt: T2 }),
        baseSub({ id: "s3", userId: "u1", username: "Alice", problemId: "p3", status: "RE", submittedAt: T1 }),
        baseSub({ id: "s4", userId: "u1", username: "Alice", problemId: "p4", status: "CE", submittedAt: T2 }),
        baseSub({ id: "s5", userId: "u1", username: "Alice", problemId: "p5", status: "PENDING", submittedAt: T1 }),
      ];

      const board = computeLeaderboard(submissions);
      expect(board).toHaveLength(1);
      const sole = board[0];
      expect(sole).toBeDefined();
      expect(sole?.totalScore).toBe(0);
      expect(sole?.earliestFullAcAt).toBeNull();
      expect(sole?.perProblemScores.every((p) => p.baseScore === 0 && p.totalScore === 0)).toBe(true);
    });

    it("sorts deterministically: total desc, earliest full-AC asc, then username asc", () => {
      const submissions: SubmissionRecord[] = [
        // Charlie: WA (non-AC) -> 0 pts, no full-AC
        baseSub({
          id: "s1",
          userId: "u3",
          username: "Charlie",
          problemId: "p3",
          status: "WA",
          submittedAt: T1,
        }),
        // Bob: full-AC p2 at T2 -> 100 pts
        baseSub({
          id: "s2",
          userId: "u2",
          username: "Bob",
          problemId: "p2",
          status: "AC",
          submittedAt: T2,
        }),
        // Alice: full-AC p1 at T1 -> 110 pts (earliest full-AC, gets bonus)
        baseSub({
          id: "s3",
          userId: "u1",
          username: "Alice",
          problemId: "p1",
          status: "AC",
          submittedAt: T1,
        }),
        // Dave: full-AC p2 at T2 (same as Bob) -> username tiebreak 'Dave' after 'Bob'
        baseSub({
          id: "s4",
          userId: "u4",
          username: "Dave",
          problemId: "p2",
          status: "AC",
          submittedAt: T2,
        }),
      ];

      const board = computeLeaderboard(submissions);
      const names = board.map((b) => b.username);

      // Alice 110, then Bob & Dave tied at 100 with equal AC time t2 -> username asc, then Charlie 0 last.
      expect(names).toEqual(["Alice", "Bob", "Dave", "Charlie"]);
    });
  });
});
