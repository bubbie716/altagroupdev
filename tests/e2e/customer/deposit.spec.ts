import { test, expect } from "@playwright/test";
import path from "node:path";
import { describeMutations } from "../utils/mutations.js";
import { hasBlobStorage } from "../utils/env.js";
import { visitAndAssert } from "../utils/page-health.js";
import { attachDepositProof, fillFlorinAmount } from "../utils/form.js";

test.describe("Deposit page", () => {
  test("loads deposit form", async ({ page }) => {
    await visitAndAssert(page, "/bank/deposit", { heading: /deposit/i });
    await expect(page.getByRole("button", { name: /submit deposit/i })).toBeVisible();
  });

  test("requires proof before submit is enabled", async ({ page }) => {
    await page.goto("/bank/deposit");
    await fillFlorinAmount(page, "50");
    const submit = page.getByRole("button", { name: /submit deposit/i });
    await expect(submit).toBeDisabled();
    await expect(page.locator('input[type="file"]')).toHaveAttribute("required", "");
  });

  describeMutations("Deposit submission", () => {
    test("submits deposit and shows success", async ({ page }, testInfo) => {
      if (!hasBlobStorage()) {
        testInfo.skip(true, "BLOB_READ_WRITE_TOKEN required for deposit proof upload.");
      }

      await page.goto("/bank/deposit");
      await fillFlorinAmount(page, "25");
      await page.getByLabel(/memo/i).fill("E2E test deposit");
      await attachDepositProof(page, path.resolve("tests/e2e/fixtures/proof.png"));

      const [response] = await Promise.all([
        page.waitForResponse(
          (resp) =>
            resp.url().includes("/api/bank/deposit-request") &&
            resp.request().method() === "POST",
          { timeout: 60_000 },
        ),
        page.getByRole("button", { name: /submit deposit/i }).click(),
      ]);
      expect(response.ok()).toBeTruthy();

      await expect(page.getByRole("heading", { name: /deposit submitted/i })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(/waiting on alta/i).first()).toBeVisible();
    });
  });
});
