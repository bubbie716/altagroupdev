import { randomInt } from "node:crypto";
import type { BankAccountTypeCode } from "@/lib/bank/backend-types";

/** Alta Bank product codes embedded in account numbers (AB-[CODE]-[UNIQUE]). */
export const BANK_PRODUCT_CODES: Record<BankAccountTypeCode, string> = {
  alta_access: "1000",
  checking: "2000",
  savings: "3000",
  money_market: "3500",
  reserve: "4000",
  business_operating: "5000",
  private: "9000",
};

const ACCOUNT_NUMBER_PATTERN = /^AB-\d{4}-\d{6}$/;

export function getProductCode(accountType: BankAccountTypeCode): string {
  return BANK_PRODUCT_CODES[accountType];
}

/** Generate a human-readable Alta Bank account number (AB-[PRODUCT]-[6-digit unique]). */
export function generateAccountNumber(accountType: BankAccountTypeCode): string {
  const code = getProductCode(accountType);
  const unique = randomInt(100_000, 1_000_000);
  return `AB-${code}-${unique}`;
}

export function isValidAltaAccountNumber(accountNumber: string): boolean {
  return ACCOUNT_NUMBER_PATTERN.test(accountNumber);
}

/** True when the account number predates the AB-[PRODUCT]-[UNIQUE] format. */
export function isLegacyAccountNumber(accountNumber: string): boolean {
  return !isValidAltaAccountNumber(accountNumber);
}
