import { test, expect } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";
import { describeMutations } from "../utils/mutations.js";
import { fillAltaPayAmount, submitAltaPayReview } from "../utils/form.js";

test.describe("Alta Pay", () => {
  test("loads Alta Pay page", async ({ page }) => {
    await visitAndAssert(page, "/bank/pay", { heading: /pay/i });
  });

  test("shows funding source selector when accounts exist", async ({ page }) => {
    await page.goto("/bank/pay");
    const hasSources =
      (await page.getByText(/pay from|funding|no eligible payment sources/i).count()) > 0;
    expect(hasSources).toBeTruthy();
  });

  describeMutations("Alta Pay compose", () => {
    test("validates empty company selection", async ({ page }, testInfo) => {
      await page.goto("/bank/pay", { waitUntil: "networkidle" });
      if (await page.getByText(/no eligible payment sources/i).isVisible()) {
        testInfo.skip(true, "No funding sources for E2E customer.");
      }

      await fillAltaPayAmount(page, "10");
      await submitAltaPayReview(page);

      await expect(page.locator("form p.text-destructive")).toContainText(
        /select a person or company to pay/i,
      );
    });
  });
});
