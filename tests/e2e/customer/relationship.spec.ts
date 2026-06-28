import { test } from "@playwright/test";
import { visitAndAssert } from "../utils/page-health.js";

test.describe("Relationship page", () => {
  test("loads relationship profile", async ({ page }) => {
    await visitAndAssert(page, "/bank/relationship");
  });
});
