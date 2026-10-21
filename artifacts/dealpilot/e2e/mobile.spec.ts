import { expect, test } from "@playwright/test";

test("mobile navigation works", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try a demo workspace" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Discover deals" }).click();
  await expect(page.getByRole("heading", { name: "Discover deals" })).toBeVisible();
  if (process.env.DEALPILOT_E2E_SCREENSHOTS) await page.screenshot({ path: `${process.env.DEALPILOT_E2E_SCREENSHOTS}/13-mobile-discover.png`, fullPage: false });
  // No horizontal page scroll at phone width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
