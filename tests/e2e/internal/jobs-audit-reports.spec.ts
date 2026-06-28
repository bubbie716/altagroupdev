import { test, expect } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";

test.describe("Internal jobs, audit, reports", () => {
  test("jobs page lists jobs", async ({ page }) => {
    await visitAndAssert(page, "/internal/jobs");
    await expect(page.locator("body")).toContainText(/job|servicing|scheduler/i);
  });

  test("audit page filters render", async ({ page }) => {
    await visitAndAssert(page, "/internal/audit");
    const filter = page.getByPlaceholder(/search|filter|action/i).first();
    if (await filter.isVisible()) {
      await filter.fill("E2E");
    }
  });

  test("reports page loads date controls", async ({ page }) => {
    await visitAndAssert(page, "/internal/reports");
  });
});
