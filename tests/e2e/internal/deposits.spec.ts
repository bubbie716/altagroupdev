import { test, expect } from "@playwright/test";
import { describeMutations } from "../utils/mutations.js";
import { loadE2eManifest } from "../utils/page-health.js";
import { internalTransactionRoute } from "../utils/routes.js";

describeMutations("Deposit review workflow", () => {
  test("opens pending deposit in workspace", async ({ page }, testInfo) => {
    const manifest = await loadE2eManifest();
    const txId = manifest.pending.depositTransactionId;
    if (!txId) testInfo.skip(true, "No seeded pending deposit.");

    await page.goto(internalTransactionRoute(txId));
    await expect(page.locator("body")).toContainText(/deposit|pending|e2e/i);

    const approve = page.getByRole("button", { name: /approve/i }).first();
    if (await approve.isVisible()) {
      await approve.click();
      const reason = page.getByLabel(/reason/i).or(page.getByPlaceholder(/reason/i));
      if (await reason.isVisible()) {
        await reason.fill("E2E test approval");
        await page.getByRole("button", { name: /confirm|approve/i }).last().click();
        await expect(page.locator("body")).not.toContainText(/application error/i);
      }
    }
  });
});
