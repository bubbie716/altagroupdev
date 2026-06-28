import { test, expect } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";
import { loadE2eManifest } from "../utils/page-health.js";

test.describe("Business banking", () => {
  test("loads business banking hub", async ({ page }) => {
    await visitAndAssert(page, "/bank/business");
  });

  test("loads company hub for business owner", async ({ page }) => {
    const manifest = await loadE2eManifest();
    await visitAndAssert(page, `/companies/${manifest.companies.harborId}`);
  });

  test("business owner sees business Alta Card area", async ({ page }) => {
    await page.goto("/bank/alta-card/business");
    await expect(page.locator("body")).toContainText(/business|alta card/i);
  });
});
