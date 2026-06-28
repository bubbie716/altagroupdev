import { test, expect } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";

const QUEUE_ROUTES = [
  "/internal/queues/deposits",
  "/internal/queues/withdrawals",
  "/internal/queues/account-openings",
  "/internal/queues/company-verifications",
  "/internal/queues/lending-applications",
  "/internal/queues/alta-card-applications",
  "/internal/queues/alta-card-reviews",
  "/internal/queues/deal-rooms",
  "/internal/queues/exceptions",
  "/internal/queues/private-banking",
] as const;

test.describe("Internal queues", () => {
  for (const route of QUEUE_ROUTES) {
    test(`queue renders: ${route}`, async ({ page }) => {
      await visitAndAssert(page, route);
      await expect(page.getByRole("main")).toBeVisible();
    });
  }

  test("deposits queue search input does not crash", async ({ page }) => {
    await page.goto("/internal/queues/deposits");
    const search = page.getByPlaceholder(/search|filter/i).first();
    if (await search.isVisible()) {
      await search.fill("E2E");
      await expect(page.locator("body")).not.toContainText(/application error/i);
    }
  });
});
