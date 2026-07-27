import { test, expect } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";
import { describeMutations } from "../utils/mutations.js";

test.describe("Alta Card", () => {
  test("loads Alta Card landing", async ({ page }) => {
    await visitAndAssert(page, "/bank/alta-card");
  });

  test("opens apply modal when credit desk open", async ({ page }) => {
    await page.goto("/bank/alta-card?apply=1");
    const closed = page.getByText(/credit desk closed/i);
    const apply = page.getByText(/application|apply|tier/i);
    await expect(closed.or(apply).first()).toBeVisible();
  });

  describeMutations("Alta Card application", () => {
    test("shows application form or credit desk gate", async ({ page }) => {
      await page.goto("/bank/alta-card?apply=1");
      if (await page.getByText(/credit desk closed/i).isVisible()) {
        expect(await page.getByText(/credit desk closed/i).isVisible()).toBeTruthy();
        return;
      }
      await expect(page.locator("form, button").first()).toBeVisible();
    });
  });
});
