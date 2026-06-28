import type { Page } from "@playwright/test";
import { screenshotPage } from "./page-health.js";

export async function captureFailureScreenshot(page: Page, name: string): Promise<void> {
  await screenshotPage(page, `failure-${name}-${Date.now()}`);
}
