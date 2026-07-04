import type { BankTransactionTypeCode } from "@/lib/bank/backend-types";

const TRANSACTION_TYPE_LABELS: Record<BankTransactionTypeCode, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  adjustment: "Adjustment",
  loan_payment: "Loan Payment",
  interest_charge: "Interest Charge",
  interest_credit: "Interest Payment",
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
