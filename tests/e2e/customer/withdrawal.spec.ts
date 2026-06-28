import { test, expect } from "@playwright/test";
import { describeMutations } from "../utils/mutations.js";
import { visitAndAssert } from "../utils/page-health.js";
import { fillFlorinAmount, readWithdrawableMax } from "../utils/form.js";

test.describe("Withdrawal page", () => {
  test("loads withdrawal form", async ({ page }) => {
    await visitAndAssert(page, "/bank/withdraw", { heading: /withdraw/i });
    await expect(page.getByRole("button", { name: /submit withdrawal/i })).toBeVisible();
  });

  test("disables submit for zero amount", async ({ page }) => {
    await page.goto("/bank/withdraw");
    await fillFlorinAmount(page, "0");
    await expect(page.getByRole("button", { name: /submit withdrawal/i })).toBeDisabled();
  });

  describeMutations("Withdrawal submission", () => {
    test("submits withdrawal request", async ({ page }, testInfo) => {
      await page.goto("/bank/withdraw");

      const maxWithdraw = await readWithdrawableMax(page);
      if (maxWithdraw === null || maxWithdraw < 0.01) {
        testInfo.skip(true, "E2E account has no available withdrawal balance.");
      }

      const amount = Math.min(1, maxWithdraw!).toString();
      await fillFlorinAmount(page, amount);
      await page.getByLabel(/memo/i).fill("E2E test withdrawal");

      const submit = page.getByRole("button", { name: /submit withdrawal/i });
      if (!(await submit.isEnabled())) {
        testInfo.skip(true, "Withdrawal submit disabled — insufficient available balance for E2E account.");
      }
      await submit.click();

      await expect(page.getByRole("heading", { name: /withdrawal submitted/i })).toBeVisible({
        timeout: 60_000,
      });
    });
  });
});
