import { test, expect } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";

test.describe("Internal settings (operator)", () => {
  test("operator can view settings", async ({ page }) => {
    await visitAndAssert(page, "/internal/settings");
  });

  test("credit desk controls hidden or disabled for operator", async ({ page }) => {
    await page.goto("/internal/settings");
    const closeDesk = page.getByRole("button", { name: /close credit desk/i });
    if (await closeDesk.isVisible()) {
      await expect(closeDesk).toBeDisabled();
    } else {
      await expect(page.getByText(/only admins can change credit desk/i)).toBeVisible();
    }
  });
});
