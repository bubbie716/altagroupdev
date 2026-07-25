import type {
  BankTransactionStatusCode,
  BankTransactionTypeCode,
  UserBankTransaction,
} from "@/lib/bank/backend-types";
import { florin } from "@/lib/bank/api";

const TRANSACTION_TYPE_LABELS: Record<BankTransactionTypeCode, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  adjustment: "Adjustment",
  loan_payment: "Loan Payment",
  interest_charge: "Interest Charge",
  interest_credit: "Interest Payment",
};

export type BankTransactionDirection = "credit" | "debit" | "neutral";
export type BankTransactionTone = "credit" | "debit" | "neutral" | "pending" | "denied";

export type BankTransactionPresentation = {
  signedAmount: number;
  direction: BankTransactionDirection;
  displayAmount: string;
  accessibleAmount: string;
  statusLabel: string | null;
  showStatus: boolean;
  tone: BankTransactionTone;
  typeLabel: string;
  amountClassName: string;
};

export function formatBankTransactionTypeLabel(type: BankTransactionTypeCode): string {
  return TRANSACTION_TYPE_LABELS[type];
}

export function isBankTransactionDebit(type: BankTransactionTypeCode): boolean {
  return type === "withdrawal" || type === "loan_payment" || type === "interest_charge";
}

/** Signed amount for activity tables: debits negative, credits positive. */
export function getSignedBankTransactionAmount(
  type: BankTransactionTypeCode,
  amount: number,
  referenceCode?: string | null,
): number {
  const abs = Math.abs(amount);
  if (type === "adjustment") {
    const ref = referenceCode?.trim().toUpperCase() ?? "";
    if (ref.startsWith("WDR")) return -abs;
    return abs;
  }
  return isBankTransactionDebit(type) ? -abs : abs;
}

function formatSignedDisplay(signed: number): string {
  const abs = florin(Math.abs(signed));
  if (signed > 0) return `+${abs}`;
  if (signed < 0) return `−${abs}`;
  return abs;
}

/**
 * One presentation model for Home, Activity, account detail, and statements.
 * Denied/cancelled amounts stay absolute and neutral so they do not look completed.
 */
export function presentBankTransaction(input: {
  type: BankTransactionTypeCode;
  amount: number;
  status: BankTransactionStatusCode;
  statusLabel?: string | null;
  referenceCode?: string | null;
  typeLabel?: string | null;
}): BankTransactionPresentation {
  const typeLabel = input.typeLabel ?? formatBankTransactionTypeLabel(input.type);
  const status = input.status;
  const isTerminalNeutral = status === "denied" || status === "cancelled";
  const isPending = status === "pending";

  const rawSigned = getSignedBankTransactionAmount(
    input.type,
    input.amount,
    input.referenceCode,
  );

  let signedAmount = rawSigned;
  let direction: BankTransactionDirection =
    rawSigned < 0 ? "debit" : rawSigned > 0 ? "credit" : "neutral";

  if (isTerminalNeutral) {
    signedAmount = Math.abs(rawSigned);
    direction = "neutral";
  }

  const displayAmount = isTerminalNeutral
    ? florin(Math.abs(input.amount))
    : formatSignedDisplay(rawSigned);

  const statusLabel =
    isPending || isTerminalNeutral
      ? input.statusLabel ?? (status === "pending" ? "Pending" : status === "denied" ? "Denied" : "Cancelled")
      : null;

  let tone: BankTransactionTone = direction === "credit" ? "credit" : direction === "debit" ? "debit" : "neutral";
  if (isPending) tone = "pending";
  if (status === "denied") tone = "denied";
  if (status === "cancelled") tone = "neutral";

  const amountClassName =
    tone === "credit"
      ? "ticker-up"
      : tone === "debit"
        ? "ticker-down"
        : tone === "denied"
          ? "text-destructive"
          : "text-muted-foreground";

  const directionWord =
    direction === "debit" ? "debit" : direction === "credit" ? "credit" : "amount";
  const accessibleAmount = statusLabel
    ? `${displayAmount} ${directionWord}, ${statusLabel}`
    : `${displayAmount} ${directionWord}`;

  return {
    signedAmount,
    direction,
    displayAmount,
    accessibleAmount,
    statusLabel,
    showStatus: Boolean(statusLabel),
    tone,
    typeLabel,
    amountClassName,
  };
}

export function presentUserBankTransaction(
  tx: Pick<
    UserBankTransaction,
    "type" | "amount" | "status" | "statusLabel" | "referenceCode" | "typeLabel"
  >,
): BankTransactionPresentation {
  return presentBankTransaction(tx);
}
