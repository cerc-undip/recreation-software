export type SubmissionStatus = "AC" | "WA" | "TLE" | "RE" | "CE" | "PENDING";

export interface SubmissionRecord {
  id: string;
  userId: string;
  username: string;
  problemId: string;
  sessionId: string;
  isRunOnly: boolean;
  status: SubmissionStatus;
  passedCases: number;
  totalCases: number;
  problemPoints: number;
  submittedAt: Date;
}

export interface PerProblemScore {
  problemId: string;
  baseScore: number;
  bonusScore: number;
  totalScore: number;
  isFullAc: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  totalScore: number;
  earliestFullAcAt: Date | null;
  perProblemScores: PerProblemScore[];
}

export function scoreProblem(passed: number, total: number, points: number): number {
  if (total === 0) return 0;
  return Math.round((passed / total) * points);
}

export function compareOutputs(actual: string, expected: string): boolean {
  const trimTrailingWhitespace = (str: string) =>
    str.replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
  return trimTrailingWhitespace(actual) === trimTrailingWhitespace(expected);
}

export function firstFullAcBonus(points: number): number {
  return Math.round(points * 0.10);
}

export function aggregateTotal(scores: PerProblemScore[]): number {
  return scores.reduce((sum, score) => sum + score.totalScore, 0);
}

export function computeLeaderboard(submissions: SubmissionRecord[]): LeaderboardEntry[] {
  const submitOnly = submissions.filter((s) => !s.isRunOnly);
  if (submitOnly.length === 0) return [];

  // 1. Find earliest full AC per (session, problem) to award bonus
  const earliestAcMap = new Map<string, SubmissionRecord>();
  for (const sub of submitOnly) {
    if (sub.status === "AC" && sub.passedCases === sub.totalCases) {
      const key = `${sub.sessionId}_${sub.problemId}`;
      const existing = earliestAcMap.get(key);
      if (!existing || sub.submittedAt < existing.submittedAt) {
        earliestAcMap.set(key, sub);
      }
    }
  }

  // 2. Group submissions by user
  const userMap = new Map<string, { username: string; subs: SubmissionRecord[] }>();
  for (const sub of submitOnly) {
    let u = userMap.get(sub.userId);
    if (!u) {
      u = { username: sub.username, subs: [] };
      userMap.set(sub.userId, u);
    }
    u.subs.push(sub);
  }

  // 3. Compute best score per problem for each user
  const board: LeaderboardEntry[] = [];

  for (const [userId, { username, subs }] of userMap.entries()) {
    const problemMap = new Map<string, SubmissionRecord[]>();
    for (const sub of subs) {
      let pSubs = problemMap.get(sub.problemId);
      if (!pSubs) {
        pSubs = [];
        problemMap.set(sub.problemId, pSubs);
      }
      pSubs.push(sub);
    }

    const perProblemScores: PerProblemScore[] = [];
    let userEarliestAc: Date | null = null;

    for (const [problemId, pSubs] of problemMap.entries()) {
      let bestBaseScore = 0;
      let hasFullAc = false;
      let gotBonus = false;
      let earliestAcForProblem: Date | null = null;
      let points = 0;

      for (const sub of pSubs) {
        points = sub.problemPoints;
        let baseScore = 0;
        if (sub.status === "AC") {
          baseScore = scoreProblem(sub.passedCases, sub.totalCases, sub.problemPoints);
        }
        if (baseScore > bestBaseScore) {
          bestBaseScore = baseScore;
        }
        
        if (sub.status === "AC" && sub.passedCases === sub.totalCases) {
          hasFullAc = true;
          if (!earliestAcForProblem || sub.submittedAt < earliestAcForProblem) {
            earliestAcForProblem = sub.submittedAt;
          }
          const key = `${sub.sessionId}_${sub.problemId}`;
          const globalEarliest = earliestAcMap.get(key);
          if (globalEarliest && globalEarliest.id === sub.id) {
            gotBonus = true;
          }
        }
      }

      if (earliestAcForProblem) {
        if (!userEarliestAc || earliestAcForProblem < userEarliestAc) {
          userEarliestAc = earliestAcForProblem;
        }
      }

      const bonusScore = gotBonus ? firstFullAcBonus(points) : 0;
      perProblemScores.push({
        problemId,
        baseScore: bestBaseScore,
        bonusScore,
        totalScore: bestBaseScore + bonusScore,
        isFullAc: hasFullAc,
      });
    }

    const totalScore = aggregateTotal(perProblemScores);
    board.push({
      userId,
      username,
      totalScore,
      earliestFullAcAt: userEarliestAc,
      perProblemScores,
    });
  }

  // 4. Sort: totalScore DESC, earliestFullAcAt ASC, username ASC
  board.sort((a, b) => {
    if (a.totalScore !== b.totalScore) {
      return b.totalScore - a.totalScore;
    }
    
    if (a.earliestFullAcAt && b.earliestFullAcAt) {
      const timeDiff = a.earliestFullAcAt.getTime() - b.earliestFullAcAt.getTime();
      if (timeDiff !== 0) return timeDiff;
    } else if (a.earliestFullAcAt && !b.earliestFullAcAt) {
      return -1;
    } else if (!a.earliestFullAcAt && b.earliestFullAcAt) {
      return 1;
    }
    
    return a.username.localeCompare(b.username);
  });

  return board;
}
