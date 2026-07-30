import {
  isBankActionId,
  parseBankActionId,
  type BankActionId,
} from "@/lib/bank/bank-action-ids";
import type { BankAccountTypeCode } from "@/lib/bank/backend-types";
import { parseBankAccountTypeCode } from "@/lib/bank/bank-product-account-type";

/**
 * Query-driven Bank action overlays.
 *
 * Contract (examples):
 *   /bank?action=deposit
 *   /bank?action=withdraw&accountId=…
 *   /bank?action=move-money
 *   /bank?action=pay
 *   /bank?action=open-account&accountType=alta_access
 *   /bank?action=card-payment&cardId=…
 *
 * Choice: query params on the current Bank path (not nested modal routes).
 * Standalone bookmarks (/bank/deposit, etc.) keep working as page shells.
 * Closing removes only action-related keys; other search params are preserved.
 * Open pushes history so Browser Back dismisses the overlay; Done/Close uses
 * replace so Back does not reopen a completed flow.
 */

export const BANK_ACTION_SEARCH_KEYS = [
  "action",
  "accountId",
  "cardId",
  "employeeCardId",
  "companyId",
  "scope",
  "accountType",
  "portfolioId",
] as const;

export type BankActionSearch = {
  action: BankActionId | null;
  accountId?: string;
  cardId?: string;
  employeeCardId?: string;
  companyId?: string;
  scope?: "personal" | "all";
  accountType?: BankAccountTypeCode;
  portfolioId?: string;
};

export function parseBankActionSearch(
  search: Record<string, unknown> | string | null | undefined,
): BankActionSearch {
  const params =
    typeof search === "string"
      ? Object.fromEntries(new URLSearchParams(search.startsWith("?") ? search.slice(1) : search))
      : (search ?? {});

  const action = parseBankActionId(params.action);
  const scope =
    params.scope === "personal" || params.scope === "all" ? params.scope : undefined;
  return {
    action,
    accountId: typeof params.accountId === "string" ? params.accountId : undefined,
    cardId: typeof params.cardId === "string" ? params.cardId : undefined,
    employeeCardId: typeof params.employeeCardId === "string" ? params.employeeCardId : undefined,
    companyId: typeof params.companyId === "string" ? params.companyId : undefined,
    scope,
    accountType: parseBankAccountTypeCode(params.accountType),
    portfolioId: typeof params.portfolioId === "string" ? params.portfolioId : undefined,
  };
}

export function stripBankActionSearch(
  search: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...search };
  for (const key of BANK_ACTION_SEARCH_KEYS) {
    delete next[key];
  }
  return next;
}

export function mergeBankActionSearch(
  current: Record<string, unknown>,
  patch: {
    action: BankActionId;
    accountId?: string;
    cardId?: string;
    employeeCardId?: string;
    companyId?: string;
    scope?: "personal" | "all";
    accountType?: BankAccountTypeCode;
    portfolioId?: string;
  },
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current, action: patch.action };
  if (patch.accountId) next.accountId = patch.accountId;
  else delete next.accountId;
  if (patch.cardId) next.cardId = patch.cardId;
  else delete next.cardId;
  if (patch.employeeCardId) next.employeeCardId = patch.employeeCardId;
  else delete next.employeeCardId;
  if (patch.companyId) next.companyId = patch.companyId;
  else delete next.companyId;
  if (patch.scope) next.scope = patch.scope;
  else delete next.scope;
  if (patch.accountType) next.accountType = patch.accountType;
  else delete next.accountType;
  if (patch.portfolioId) next.portfolioId = patch.portfolioId;
  else delete next.portfolioId;
  return next;
}

/** Drop invalid `action` / `accountType` values while keeping unrelated params. */
export function sanitizeBankActionSearch(
  search: Record<string, unknown>,
): Record<string, unknown> {
  let next = search;
  if (search.action != null && !isBankActionId(search.action)) {
    next = { ...next };
    delete next.action;
  }
  if (next.accountType != null && !parseBankAccountTypeCode(next.accountType)) {
    next = next === search ? { ...next } : next;
    delete next.accountType;
  }
  return next;
}
