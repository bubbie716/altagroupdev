import { test, expect } from "@playwright/test";
import path from "node:path";
import { describeMutations } from "../utils/mutations.js";
import { hasBlobStorage } from "../utils/env.js";
import { visitAndAssert } from "../utils/page-health.js";
import { attachDepositProof, fillFlorinAmount } from "../utils/form.js";

test.describe("Deposit overlay", () => {
  test("loads deposit form via overlay", async ({ page }) => {
    await visitAndAssert(page, "/bank?action=deposit");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/deposit/i).first()).toBeVisible();
  });

  test("legacy /bank/deposit redirects into overlay", async ({ page }) => {
    await visitAndAssert(page, "/bank/deposit");
    await expect(page).toHaveURL(/action=deposit/);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("requires proof before continue is enabled", async ({ page }) => {
    await page.goto("/bank?action=deposit");
    await fillFlorinAmount(page, "50");
    const continueBtn = page.getByRole("button", { name: /continue|review|submit deposit/i }).first();
    await expect(continueBtn).toBeDisabled();
  });

  describeMutations("Deposit submission", () => {
    test("submits deposit and shows success", async ({ page }, testInfo) => {
      if (!hasBlobStorage()) {
        testInfo.skip(true, "BLOB_READ_WRITE_TOKEN required for deposit proof upload.");
      }

      await page.goto("/bank?action=deposit");
      await fillFlorinAmount(page, "25");
      await attachDepositProof(page, path.resolve("tests/e2e/fixtures/proof.png"));

      const continueBtn = page.getByRole("button", { name: /continue|review/i }).first();
      if (await continueBtn.isEnabled()) {
        await continueBtn.click();
      }

      const submit = page.getByRole("button", { name: /submit deposit|confirm|submit/i }).first();
      const [response] = await Promise.all([
        page.waitForResponse(
          (resp) =>
            resp.url().includes("/api/bank/deposit-request") &&
            resp.request().method() === "POST",
          { timeout: 60_000 },
        ),
        submit.click(),
      ]);
      expect(response.ok()).toBeTruthy();

      await expect(page.getByText(/pending review|deposit submitted|submitted/i).first()).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});
