import { test, expect } from "@playwright/test";
import { INTERNAL_STATIC_ROUTES, internalTransactionRoute, internalUserRoute, internalCompanyRoute } from "../utils/routes.js";
import { visitAndAssert, loadE2eManifest } from "../utils/page-health.js";

test.describe("Internal route smoke", () => {
  for (const route of INTERNAL_STATIC_ROUTES) {
    test(`loads ${route}`, async ({ page }) => {
      await visitAndAssert(page, route);
    });
  }

  test("loads seeded transaction workspace", async ({ page }) => {
    const manifest = await loadE2eManifest();
    if (manifest.pending.depositTransactionId) {
      await visitAndAssert(
        page,
        internalTransactionRoute(manifest.pending.depositTransactionId),
      );
    }
  });

  test("loads customer workspace", async ({ page }) => {
    const manifest = await loadE2eManifest();
    await visitAndAssert(page, internalUserRoute(manifest.users.customer.id));
    await expect(page.locator("body")).toContainText(/customer|user|e2e/i);
  });

  test("loads company workspace", async ({ page }) => {
    const manifest = await loadE2eManifest();
    await visitAndAssert(page, internalCompanyRoute(manifest.companies.harborId));
  });
});
