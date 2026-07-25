/**
 * Typed Alta Bank customer action registry for overlay / page flows.
 * Invalid values are ignored safely by parsers.
 */

export const BANK_ACTION_IDS = [
  "move-money",
  "transfer",
  "pay",
  "deposit",
  "withdraw",
  "open-account",
  "card-payment",
  "card-cash-advance",
  "card-freeze",
  "card-unfreeze",
  "card-autopay",
] as const;

export type BankActionId = (typeof BANK_ACTION_IDS)[number];

export const BANK_ACTION_LABELS: Record<BankActionId, string> = {
  "move-money": "Move money",
  transfer: "Transfer",
  pay: "Alta Pay",
  deposit: "Deposit",
  withdraw: "Withdraw",
  "open-account": "Open account",
  "card-payment": "Make payment",
  "card-cash-advance": "Cash advance",
  "card-freeze": "Freeze card",
  "card-unfreeze": "Unfreeze card",
  "card-autopay": "Autopay",
};

export function isBankActionId(value: unknown): value is BankActionId {
  return typeof value === "string" && (BANK_ACTION_IDS as readonly string[]).includes(value);
}

export function parseBankActionId(value: unknown): BankActionId | null {
  return isBankActionId(value) ? value : null;
}

/** Standalone page routes that host the same underlying form as overlays. */
export const BANK_ACTION_PAGE_ROUTES: Partial<Record<BankActionId, string>> = {
  deposit: "/bank/deposit",
  withdraw: "/bank/withdraw",
  transfer: "/bank/transfers/intrabank",
  pay: "/bank/pay",
  "open-account": "/bank/open",
};
