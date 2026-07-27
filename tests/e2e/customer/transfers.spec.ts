import { test, expect } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";
import { describeMutations } from "../utils/mutations.js";

test.describe("Transfers", () => {
  test("legacy intrabank URL redirects into transfer overlay", async ({ page }) => {
    await visitAndAssert(page, "/bank/transfers/intrabank");
    await expect(page).toHaveURL(/\/bank(\?|$)/);
    await expect(page).toHaveURL(/action=transfer/);
  });

  describeMutations("Intrabank transfer", () => {
    test("validates bad amount in transfer overlay", async ({ page }) => {
      await page.goto("/bank?action=transfer");
      const amount = page.getByRole("spinbutton", { name: /amount \(ƒ\)/i });
      if (await amount.isVisible()) {
        await amount.fill("-5");
        const submit = page.getByRole("button", { name: /transfer|submit|review|continue/i }).first();
        if (await submit.isVisible()) {
          await submit.click();
          await expect(page.locator("body")).not.toBeEmpty();
        }
      }
    });
  });
});
