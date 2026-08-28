import { expect, test } from "@playwright/test";

// Given: An authenticated participant navigating to /play where a 3D ambient background renders.
// When: Reduced motion is disabled and we take two screenshots ~900ms apart of the canvas.
// Then: The byte difference ratio must exceed 0.70 to prove the animation is visible/strong enough.

test("ambient background animation motion strength exceeds baseline", async ({ page }) => {
  // Match the 1920x935 canvas used to measure the ~0.52 baseline ratio,
  // so the threshold is evidence-based against that geometry.
  await page.setViewportSize({ width: 1920, height: 935 });
  await page.emulateMedia({ reducedMotion: "no-preference" });

  const dummySessionId = "sess_456";

  const fakeToken = "fake.token.signature";

  await page.addInitScript((token) => {
    window.localStorage.setItem("codearena_token", token);
  }, fakeToken);

  await page.route("**/api/session/state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          sessionId: dummySessionId,
          code: "XYZ123",
          status: "waiting", // Will update to active shortly after

          currentProblemIndex: 0,
          currentProblemId: null,
          totalProblems: 1,
          currentProblemStartedAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.route("**/api/problem/current", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          status: "active",
          problem: {
            id: "prob_1",
            title: "Test Problem",
            description: "Test",
            inputFormat: "Test",
            outputFormat: "Test",
            constraints: "Test",
            sampleInput: "Test",
            sampleOutput: "Test",
            starterCode: "print(1)",
            timeLimitMs: 1000,
            points: 10,
          },
        },
      }),
    });
  });

  // Collect page errors to ensure Three/R3F don't crash
  const pageErrors: Error[] = [];
  page.on("pageerror", (err) => pageErrors.push(err));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      pageErrors.push(new Error(msg.text()));
    }
  });

  await page.goto("/play");

  // Initially mocked 'waiting' so it renders the lobby view first, like reality.
  // Now change the mock to 'active' so we transition.
  await page.route("**/api/session/state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          sessionId: dummySessionId,
          code: "XYZ123",
          status: "active",
          currentProblemIndex: 0,
          currentProblemId: "prob_1",
          totalProblems: 1,
          currentProblemStartedAt: new Date().toISOString(),
        },
      }),
    });
  }, { times: 1000 }); // keep serving active

  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 10000 });
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox?.width ?? 0).toBeGreaterThan(0);
  expect(canvasBox?.height ?? 0).toBeGreaterThan(0);

  await page.waitForTimeout(500);
  expect(pageErrors.length).toBe(0);

  const shot1 = await canvas.screenshot();

  await page.waitForTimeout(900);

  const shot2 = await canvas.screenshot();

  expect(pageErrors.length).toBe(0);

  // PNG bytes: compression makes identical pixels collapse, so differing bytes track visual change.
  let diffCount = 0;
  const minLen = Math.min(shot1.length, shot2.length);
  const maxLen = Math.max(shot1.length, shot2.length);

  for (let i = 0; i < minLen; i++) {
    if (shot1[i] !== shot2[i]) {
      diffCount++;
    }
  }
  diffCount += maxLen - minLen;

  const ratio = diffCount / maxLen;

  // Observed baseline ~0.658 over 900ms on 1920x935; 0.70 demands visibly stronger motion.
  const TARGET_THRESHOLD = 0.70;

  console.log(`Observed canvas diff ratio: ${ratio.toFixed(4)} over 900ms (Target: >= ${TARGET_THRESHOLD})`);
  expect(ratio).toBeGreaterThanOrEqual(TARGET_THRESHOLD);
});
