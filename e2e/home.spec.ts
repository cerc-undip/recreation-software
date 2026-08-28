import { expect, test } from "@playwright/test";

test("home page loads successfully with HTTP 200", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
});
