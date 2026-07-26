import {
  BANK_ACCOUNT_TYPE_OPTIONS,
  type BankAccountTypeCode,
} from "@/lib/bank/backend-types";

/**
 * Map public catalog product names (and backend type labels) to openable
 * account types. Used by Products → Details → Open account.
 */
const PRODUCT_NAME_TO_ACCOUNT_TYPE: Record<string, BankAccountTypeCode> = {
  "Alta Access": "alta_access",
  "Alta Checking": "checking",
  "Alta Savings": "savings",
  "Alta Money Market": "money_market",
  "Business Operating Account": "business_operating",
};

export function isBankAccountTypeCode(value: unknown): value is BankAccountTypeCode {
  return (
    typeof value === "string" &&
    BANK_ACCOUNT_TYPE_OPTIONS.some((option) => option.value === value)
  );
}

export function parseBankAccountTypeCode(
  value: unknown,
): BankAccountTypeCode | undefined {
  return isBankAccountTypeCode(value) ? value : undefined;
}

/** Resolve a catalog product name (or type label) to an account type code. */
export function resolveBankAccountTypeFromProductName(
  name: string | null | undefined,
): BankAccountTypeCode | undefined {
  if (!name?.trim()) return undefined;
  const trimmed = name.trim();
  if (PRODUCT_NAME_TO_ACCOUNT_TYPE[trimmed]) {
    return PRODUCT_NAME_TO_ACCOUNT_TYPE[trimmed];
  }
  const byLabel = BANK_ACCOUNT_TYPE_OPTIONS.find((option) => option.label === trimmed);
  return byLabel?.value;
}

export function ownershipForAccountType(
  accountType: BankAccountTypeCode,
): "personal" | "company" {
  return accountType === "business_operating" ? "company" : "personal";
}
