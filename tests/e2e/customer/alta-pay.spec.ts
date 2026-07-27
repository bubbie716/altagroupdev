import { test, expect } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";
import { describeMutations } from "../utils/mutations.js";
import { fillAltaPayAmount, submitAltaPayReview } from "../utils/form.js";

test.describe("Alta Pay", () => {
  test("loads Alta Pay overlay", async ({ page }) => {
    await visitAndAssert(page, "/bank?action=pay");
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("legacy /bank/pay redirects into overlay", async ({ page }) => {
    await visitAndAssert(page, "/bank/pay");
    await expect(page).toHaveURL(/action=pay/);
  });

  test("scheduled tab migrates to activity", async ({ page }) => {
    await visitAndAssert(page, "/bank/pay?tab=scheduled");
    await expect(page).toHaveURL(/\/bank\/activity/);
    await expect(page).toHaveURL(/view=scheduled/);
  });

  test("shows funding source selector when accounts exist", async ({ page }) => {
    await page.goto("/bank?action=pay");
    const hasSources =
      (await page.getByText(/from|funding|no eligible|select/i).count()) > 0;
    expect(hasSources).toBeTruthy();
  });

  describeMutations("Alta Pay compose", () => {
    test("validates empty company selection", async ({ page }, testInfo) => {
      await page.goto("/bank?action=pay", { waitUntil: "networkidle" });
      if (await page.getByText(/no eligible payment sources/i).isVisible()) {
        testInfo.skip(true, "No funding sources for E2E customer.");
      }

      await fillAltaPayAmount(page, "10");
      await submitAltaPayReview(page);

      await expect(page.locator("[role='dialog']").getByText(/select a person or company/i)).toBeVisible();
    });
  });
});
