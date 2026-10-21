import { expect, test, type Page } from "@playwright/test";

const shots = process.env.DEALPILOT_E2E_SCREENSHOTS;
async function snap(page: Page, name: string) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

test.describe.configure({ mode: "serial" });

test("demo workspace: discover → analyze → underwrite → workflow → offer → export", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await snap(page, "01-login");
  await page.getByRole("button", { name: "Try a demo workspace" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await snap(page, "02-dashboard-empty");

  // Discover: samples are labelled, filters work.
  await page.getByRole("link", { name: "Discover deals" }).first().click();
  await expect(page.getByText("10 properties")).toBeVisible();
  await expect(page.getByText("SAMPLE DATA — NOT REAL LISTINGS").first()).toBeVisible();
  await page.getByRole("button", { name: "Foreclosures" }).click();
  await expect(page.getByText("1 property")).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Search").fill("duplex");
  await expect(page.getByText("1 property")).toBeVisible();
  await snap(page, "03-discover");

  // Analyze the duplex → deal page.
  await page.getByRole("button", { name: "Analyze" }).first().click();
  await expect(page).toHaveURL(/\/deals\/[0-9a-f-]+$/);
  await expect(page.getByText("This property is fictional")).toBeVisible();
  await expect(page.getByText("Cash flow / month")).toBeVisible();
  await snap(page, "04-deal-overview");

  // Underwriting: edit insurance, see unsaved state, save a new version.
  await page.getByRole("tab", { name: "Underwriting" }).click();
  const insurance = page.getByLabel("Insurance", { exact: true });
  await insurance.fill("1500");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Saved assumptions \(version 2\)/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Formulas" })).toBeVisible();
  await snap(page, "05-underwriting");

  // Validation: vacancy > 100 is rejected client-side.
  await page.getByLabel("Vacancy & credit loss").fill("150");
  await expect(page.getByText("Must be 100% or less")).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();

  // Financing comparison.
  await page.getByRole("tab", { name: "Financing" }).click();
  await expect(page.getByText("Illustrative scenarios only")).toBeVisible();
  await page.getByRole("button", { name: "Add scenario" }).click();
  await page.getByLabel("Scenario type").selectOption("seller");
  await page.getByRole("button", { name: "Save scenario" }).click();
  await expect(page.getByText("Scenario saved")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Seller financing/ })).toBeVisible();
  await snap(page, "06-financing");

  // Workflow → needs review → approve.
  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Run analysis" }).click();
  await expect(page.getByText("Ready for your review", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo mode — not live AI").first()).toBeVisible();
  await snap(page, "07-workflow-review");
  await page.getByRole("button", { name: "Approve & save report" }).click();
  await expect(page.getByText("Report saved to Reports", { exact: true })).toBeVisible();

  // AI analyst (demo) answers and labels basis.
  await page.getByRole("tab", { name: "AI analyst" }).click();
  await expect(page.getByRole("heading", { name: "What the numbers mean" })).toBeVisible();
  await page.getByLabel("Your question").fill("What is the cap rate?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText(/Annual NOI ÷ purchase price/).last()).toBeVisible();
  await snap(page, "08-analyst");

  // Tasks were generated; complete one.
  await page.getByRole("tab", { name: "Due diligence" }).click();
  await expect(page.getByText("Order a title search / preliminary title report", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /Mark “Order a title search/ }).click();
  await page.getByRole("button", { name: "done", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Mark “Order a title search.*not done/ })).toBeChecked();
  await snap(page, "09-tasks");

  // Offer draft v1 and export.
  await page.getByRole("tab", { name: "Offer" }).click();
  await expect(page.getByText("DRAFT — NOT SUBMITTED").first()).toBeVisible();
  await page.getByLabel("Buyer name").fill("Demo Buyer LLC");
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByText("Saved draft version 1")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await snap(page, "10-offer");

  // Reports tab lists the approved report and the offer export.
  await page.getByRole("tab", { name: "Reports" }).click();
  await expect(page.getByText(/Investment report —/).first()).toBeVisible();
  await expect(page.getByText(/Offer draft v1 —/).first()).toBeVisible();

  // Pipeline shows the deal, and dashboard counts update.
  await page.getByRole("link", { name: "Deal pipeline" }).first().click();
  await expect(page.getByRole("link", { name: "Brick duplex near Willowmere park" })).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).first().click();
  await expect(page.getByText("Draft offers")).toBeVisible();
  await snap(page, "11-dashboard");

  // Integrations are reported honestly.
  await page.getByRole("link", { name: "Integrations" }).first().click();
  await expect(page.getByText("AI analyst (Anthropic Claude)")).toBeVisible();
  await expect(page.getByText("Not configured").first()).toBeVisible();
  await snap(page, "12-integrations");
});

test("manual entry validates and creates a private property", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try a demo workspace" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto("/discover?new=manual");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Add property" }).click();
  await expect(dialog.getByText("Please fix the highlighted fields.")).toBeVisible();
  await dialog.getByLabel("Short name").fill("Maple St lead");
  await dialog.getByLabel("Street address").fill("12 Maple St");
  await dialog.getByRole("textbox", { name: "City", exact: true }).fill("Dayton");
  await dialog.getByRole("textbox", { name: "State", exact: true }).fill("OH");
  await dialog.getByLabel("Asking / list price").fill("99000");
  await dialog.getByRole("button", { name: "Add property" }).click();
  await expect(page.getByRole("heading", { name: "Maple St lead" })).toBeVisible();
  await expect(page.getByText("Manual entry").first()).toBeVisible();
});
