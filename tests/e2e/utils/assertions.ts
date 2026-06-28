import { expect, type Page } from "@playwright/test";

export async function expectNotLoggedOut(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function expectNoCrashScreen(page: Page): Promise<void> {
  await expect(page.locator("body")).not.toContainText(/application error|internal server error/i);
}

export async function expectHeadingVisible(page: Page, pattern: RegExp): Promise<void> {
  await expect(page.getByRole("heading", { name: pattern }).first()).toBeVisible();
}
