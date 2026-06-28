import { test, expect } from "@playwright/test";
import { describeMutations } from "../utils/mutations.js";
import { loadE2eManifest } from "../utils/page-health.js";
import { internalTransactionRoute } from "../utils/routes.js";

describeMutations("Withdrawal review workflow", () => {
  test("opens pending withdrawal workspace", async ({ page }, testInfo) => {
    const manifest = await loadE2eManifest();
    const txId = manifest.pending.withdrawalTransactionId;
    if (!txId) testInfo.skip(true, "No seeded pending withdrawal.");

    await page.goto(internalTransactionRoute(txId));
    await expect(page.locator("body")).toContainText(/withdraw|pending|e2e/i);

    const deny = page.getByRole("button", { name: /deny/i }).first();
    if (await deny.isVisible()) {
      await deny.click();
      const reason = page.getByLabel(/reason/i).or(page.getByPlaceholder(/reason/i));
      if (await reason.isVisible()) {
        await reason.fill("E2E test denial");
        await page.getByRole("button", { name: /confirm|deny/i }).last().click();
      }
    }
  });
});
