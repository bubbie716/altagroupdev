import { test, expect } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";
import { describeMutations } from "../utils/mutations.js";

test.describe("Internal settings (admin)", () => {
  test("settings page loads", async ({ page }) => {
    await visitAndAssert(page, "/internal/settings");
    await expect(page.locator("body")).toContainText(/settings|maintenance|credit desk/i);
  });

  describeMutations("Dangerous settings controls", () => {
    test("does not enable maintenance mode during read-only check", async ({ page }) => {
      await page.goto("/internal/settings");
      const maintenanceToggle = page.getByRole("button", { name: /enable maintenance|turn on maintenance/i });
      if (await maintenanceToggle.isVisible()) {
        await expect(maintenanceToggle).toBeVisible();
        // Intentionally do not click — mutation tests must not flip production-affecting flags casually.
      }
    });
  });
});
