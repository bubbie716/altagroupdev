import { test } from "@playwright/test";
import { visitAndAssert, screenshotPage } from "./utils/page-health.js";

const KEY_PAGES = [
  { name: "bank-dashboard", path: "/bank" },
  { name: "deposit-overlay", path: "/bank?action=deposit" },
  { name: "withdrawal-overlay", path: "/bank?action=withdraw" },
  { name: "activity-requests", path: "/bank/activity?view=requests" },
  { name: "alta-card", path: "/bank/alta-card" },
  { name: "lending", path: "/bank/lending?apply=1" },
  { name: "internal-dashboard", path: "/internal" },
  { name: "internal-deposits-queue", path: "/internal/queues/deposits" },
] as const;

test.describe("Visual sanity screenshots", () => {
  test("capture key pages", async ({ page }) => {
    for (const item of KEY_PAGES) {
      await visitAndAssert(page, item.path);
      await screenshotPage(page, item.name);
    }
  });
});
