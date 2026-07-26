/**
 * Pure dirty-state helpers for Bank action forms.
 * Dirty when any meaningful field differs from the form's initial snapshot.
 */

export type PayFormDirtyInput = {
  amount: string;
  memo: string;
  hasSelectedRecipient: boolean;
  fundingKey: string;
  initialFundingKey: string;
};

/** Pay is dirty when amount, note, recipient, or source account differs from initial. */
export function isPayFormDirty(input: PayFormDirtyInput): boolean {
  if (input.amount.trim() !== "") return true;
  if (input.memo.trim() !== "") return true;
  if (input.hasSelectedRecipient) return true;
  if (
    input.fundingKey !== "" &&
    input.initialFundingKey !== "" &&
    input.fundingKey !== input.initialFundingKey
  ) {
    return true;
  }
  return false;
}

export type TransferFormDirtyInput = {
  amount: string;
  memo: string;
  timing: "now" | "scheduled" | "recurring";
  fromAccountId: string;
  toAccountId: string;
  scheduledDate: string;
  scheduledTime: string;
  frequency: string;
  initial: {
    amount: string;
    memo: string;
    timing: "now" | "scheduled" | "recurring";
    fromAccountId: string;
    toAccountId: string;
    scheduledDate: string;
    scheduledTime: string;
    frequency: string;
  };
};

export function isTransferFormDirty(input: TransferFormDirtyInput): boolean {
  const { initial } = input;
  if (input.amount.trim() !== initial.amount.trim()) return true;
  if (input.memo.trim() !== initial.memo.trim()) return true;
  if (input.timing !== initial.timing) return true;
  if (input.fromAccountId !== initial.fromAccountId) return true;
  if (input.toAccountId !== initial.toAccountId) return true;
  if (input.timing === "scheduled" || input.timing === "recurring") {
    if (input.scheduledDate !== initial.scheduledDate) return true;
    if (input.scheduledTime !== initial.scheduledTime) return true;
  }
  if (input.timing === "recurring" && input.frequency !== initial.frequency) {
    return true;
  }
  return false;
}

export type DepositFormDirtyInput = {
  amount: string;
  hasProofFile: boolean;
  bankAccountId: string;
  initialBankAccountId: string;
};

export function isDepositFormDirty(input: DepositFormDirtyInput): boolean {
  if (input.amount.trim() !== "") return true;
  if (input.hasProofFile) return true;
  if (
    input.bankAccountId !== "" &&
    input.initialBankAccountId !== "" &&
    input.bankAccountId !== input.initialBankAccountId
  ) {
    return true;
  }
  return false;
}

export type WithdrawFormDirtyInput = {
  amount: string;
  destination: string;
  bankAccountId: string;
  initialBankAccountId: string;
};

export function isWithdrawFormDirty(input: WithdrawFormDirtyInput): boolean {
  if (input.amount.trim() !== "") return true;
  if (input.destination.trim() !== "") return true;
  if (
    input.bankAccountId !== "" &&
    input.initialBankAccountId !== "" &&
    input.bankAccountId !== input.initialBankAccountId
  ) {
    return true;
  }
  return false;
}

export type OpenAccountFormDirtyInput = {
  accountName: string;
  ownership: "personal" | "company";
  accountType: string;
  companyId: string;
  initial: {
    accountName: string;
    ownership: "personal" | "company";
    accountType: string;
    companyId: string;
  };
};

export function isOpenAccountFormDirty(input: OpenAccountFormDirtyInput): boolean {
  if (input.accountName.trim() !== input.initial.accountName.trim()) return true;
  if (input.ownership !== input.initial.ownership) return true;
  if (input.accountType !== input.initial.accountType) return true;
  if (input.companyId !== input.initial.companyId) return true;
  return false;
}
