import { test } from "@playwright/test";
import { visitAndAssert, screenshotPage } from "./utils/page-health.js";

const KEY_PAGES = [
  { name: "bank-dashboard", path: "/bank" },
  { name: "deposit", path: "/bank/deposit" },
  { name: "withdrawal", path: "/bank/withdraw" },
  { name: "alta-card", path: "/bank/alta-card" },
  { name: "lending", path: "/bank/lending/apply" },
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
