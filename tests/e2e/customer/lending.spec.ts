import { test, expect } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";
import { describeMutations } from "../utils/mutations.js";

test.describe("Lending", () => {
  test("loads lending overview", async ({ page }) => {
    await visitAndAssert(page, "/bank/lending");
  });

  test("loads applications list", async ({ page }) => {
    await visitAndAssert(page, "/bank/lending/applications");
  });

  describeMutations("Lending application", () => {
    test("loads apply form or credit desk closed page", async ({ page }) => {
      await page.goto("/bank/lending/apply");
      const body = page.locator("body");
      await expect(
        body.getByText(/credit desk closed|apply|loan|application/i).first(),
      ).toBeVisible();
    });
  });
});
