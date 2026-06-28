import { test, expect } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";

test.describe("Internal lending & Alta Card", () => {
  test("lending applications queue loads", async ({ page }) => {
    await visitAndAssert(page, "/internal/queues/lending-applications");
  });

  test("Alta Card applications queue loads", async ({ page }) => {
    await visitAndAssert(page, "/internal/queues/alta-card-applications");
  });

  test("Alta Card reviews queue loads", async ({ page }) => {
    await visitAndAssert(page, "/internal/queues/alta-card-reviews");
  });

  test("lending index loads", async ({ page }) => {
    await visitAndAssert(page, "/internal/lending");
  });

  test("alta card index loads", async ({ page }) => {
    await visitAndAssert(page, "/internal/alta-card");
  });
});
