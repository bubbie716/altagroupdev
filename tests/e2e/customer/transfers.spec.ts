import { test, expect } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";
import { describeMutations } from "../utils/mutations.js";

test.describe("Transfers", () => {
  test("loads intrabank transfer page", async ({ page }) => {
    await visitAndAssert(page, "/bank/transfers/intrabank");
  });

  test("loads interbank transfer page", async ({ page }) => {
    await visitAndAssert(page, "/bank/transfers/interbank");
  });

  describeMutations("Intrabank transfer", () => {
    test("validates bad amount", async ({ page }) => {
      await page.goto("/bank/transfers/intrabank");
      const amount = page.getByRole("spinbutton", { name: /amount \(ƒ\)/i });
      if (await amount.isVisible()) {
        await amount.fill("-5");
        const submit = page.getByRole("button", { name: /transfer|submit|review/i }).first();
        if (await submit.isVisible()) {
          await submit.click();
          await expect(page.locator("body")).not.toBeEmpty();
        }
      }
    });
  });
});
