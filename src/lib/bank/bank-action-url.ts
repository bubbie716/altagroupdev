import {
  isBankActionId,
  parseBankActionId,
  type BankActionId,
} from "@/lib/bank/bank-action-ids";

/**
 * Query-driven Bank action overlays.
 *
 * Contract (examples):
 *   /bank?action=deposit
 *   /bank?action=withdraw&accountId=…
 *   /bank?action=move-money
 *   /bank?action=pay
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
  "companyId",
  "scope",
] as const;

export type BankActionSearch = {
  action: BankActionId | null;
  accountId?: string;
  cardId?: string;
  companyId?: string;
  scope?: "personal" | "all";
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
    companyId: typeof params.companyId === "string" ? params.companyId : undefined,
    scope,
  };
}

export function stripBankActionSearch<T extends Record<string, unknown>>(
  search: T,
): Omit<T, "action" | "accountId" | "cardId" | "companyId"> & Record<string, unknown> {
  const next = { ...search } as Record<string, unknown>;
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
    companyId?: string;
    scope?: "personal" | "all";
  },
): Record<string, unknown> {
  const next = { ...current, action: patch.action };
  if (patch.accountId) next.accountId = patch.accountId;
  else delete next.accountId;
  if (patch.cardId) next.cardId = patch.cardId;
  else delete next.cardId;
  if (patch.companyId) next.companyId = patch.companyId;
  else delete next.companyId;
  if (patch.scope) next.scope = patch.scope;
  else delete next.scope;
  return next;
}

/** Drop invalid `action` values while keeping unrelated params. */
export function sanitizeBankActionSearch(
  search: Record<string, unknown>,
): Record<string, unknown> {
  if (search.action == null) return search;
  if (isBankActionId(search.action)) return search;
  const next = { ...search };
  delete next.action;
  return next;
}
