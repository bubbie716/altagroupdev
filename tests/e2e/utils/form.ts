import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Fill a Florin amount field and assert React state updated. */
export async function fillFlorinAmount(
  page: Page,
  amount: string,
  label: RegExp = /amount \(ƒ\)/i,
): Promise<void> {
  const input = page.getByRole("spinbutton", { name: label });
  await input.click();
  await input.fill(amount);
  await expect(input).toHaveValue(amount);
}

/** Select a bank account from the deposit/withdraw account picker when needed. */
export async function selectBankAccount(page: Page, namePattern: RegExp): Promise<void> {
  const combobox = page.getByRole("combobox", { name: /bank account/i });
  const current = await combobox.textContent();
  if (current && namePattern.test(current)) return;

  await combobox.click();
  await page.getByRole("listbox").getByRole("option", { name: namePattern }).click();
}

/** Fill Alta Pay amount (FLR). */
export async function fillAltaPayAmount(page: Page, amount: string): Promise<void> {
  const input = page.getByLabel(/amount \(flr\)/i);
  await input.click();
  await input.fill(amount);
  await expect(input).toHaveValue(amount);
}

/** Submit Alta Pay compose step for review. */
export async function submitAltaPayReview(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^review payment$/i }).click();
}

/** Attach deposit proof and wait until submit is enabled. */
export async function attachDepositProof(page: Page, filePath: string): Promise<void> {
  const fileInput = page.locator('input[type="file"]');
  const submit = page.getByRole("button", { name: /submit deposit/i });
  await fileInput.setInputFiles(filePath);
  try {
    await expect(submit).toBeEnabled({ timeout: 5_000 });
  } catch {
    await fileInput.evaluate((input) => {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(submit).toBeEnabled({ timeout: 15_000 });
  }
}

/** Read max withdrawable amount from the amount input, if exposed. */
export async function readWithdrawableMax(page: Page): Promise<number | null> {
  const input = page.getByRole("spinbutton", { name: /amount \(ƒ\)/i });
  const max = await input.getAttribute("max");
  if (!max) return null;
  const parsed = Number(max);
  return Number.isFinite(parsed) ? parsed : null;
}
