import { test } from "@playwright/test";
import { visitAndAssert } from "./utils/page-health.js";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const ROUTES = [
  "/bank",
  "/bank/deposit",
  "/bank/withdraw",
  "/bank/alta-card",
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`Responsive ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of ROUTES) {
      test(`${route} renders without crash`, async ({ page }) => {
        await visitAndAssert(page, route);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        if (viewport.name === "desktop" && scrollWidth > clientWidth + 40) {
          throw new Error(`Unexpected horizontal overflow on ${route}`);
        }
      });
    }
  });
}
