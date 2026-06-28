import { test, expect } from "@playwright/test";
import { loadE2eManifest, visitAndAssert } from "../utils/page-health.js";
import { internalTransactionRoute, internalUserRoute } from "../utils/routes.js";

test.describe("Internal workspaces", () => {
  test("transaction workspace tabs load", async ({ page }, testInfo) => {
    const manifest = await loadE2eManifest();
    const txId = manifest.pending.depositTransactionId;
    if (!txId) {
      testInfo.skip(true, "No seeded pending deposit transaction.");
    }
    await visitAndAssert(page, internalTransactionRoute(txId));
    const tabs = page.getByRole("tab");
    if ((await tabs.count()) > 0) {
      await tabs.first().click();
      await expect(page.locator("body")).not.toContainText(/application error/i);
    }
  });

  test("customer workspace notes panel does not crash", async ({ page }) => {
    const manifest = await loadE2eManifest();
    await visitAndAssert(page, internalUserRoute(manifest.users.customer.id));
    await expect(page.locator("body")).not.toContainText(/internal server error/i);
  });
});
