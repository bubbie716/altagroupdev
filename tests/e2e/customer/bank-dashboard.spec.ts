import { test, expect } from "@playwright/test";
import { BANK_STATIC_ROUTES, bankAccountRoute } from "../utils/routes.js";
import { visitAndAssert, loadE2eManifest } from "../utils/page-health.js";

test.describe("Bank route smoke", () => {
  for (const route of BANK_STATIC_ROUTES) {
    test(`loads ${route}`, async ({ page }) => {
      await visitAndAssert(page, route);
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }

  test("loads account detail from seed", async ({ page }) => {
    const manifest = await loadE2eManifest();
    await visitAndAssert(page, bankAccountRoute(manifest.accounts.customerCheckingId));
  });
});
