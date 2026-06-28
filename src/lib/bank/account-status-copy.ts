import type { BankAccountStatusCode, CustomerAccountStatus } from "@/lib/bank/backend-types";

export const ACCOUNT_STATUS_COPY = {
  goodStanding: "This account is in good standing.",
  activeGoodStanding: "This account is active and in good standing.",
  restricted: "This account has temporary restrictions.",
  frozen: "This account is temporarily frozen. Some account activity may be unavailable.",
  closed: "This account is closed.",
  depositRestricted: "Deposits are currently unavailable for this account.",
  withdrawalRestricted: "Withdrawals are currently unavailable for this account.",
  transferRestricted: "Transfers are currently unavailable for this account.",
  fundsOnHold: "Some funds are currently on hold and may not be available for withdrawal or transfer.",
  underReview: "Some activity on this account may require review by Alta.",
  pendingReview: "This account is under review by Alta.",
  heldFundsExplanation:
    "Held funds reduce your available balance until they are released.",
} as const;

export type BankMoneyAction = "deposit" | "withdraw" | "transfer" | "pay";

export function buildCustomerAccountStatus(input: {
  status: BankAccountStatusCode;
  restrictDeposits: boolean;
  restrictWithdrawals: boolean;
  restrictTransfers: boolean;
  heldFunds: number;
  pendingWithdrawals: number;
}): CustomerAccountStatus {
  const notices: string[] = [];
  const hasRestrictions =
    input.restrictDeposits || input.restrictWithdrawals || input.restrictTransfers;
  const hasHolds = input.heldFunds > 0;

  if (input.status === "closed") {
    notices.push(ACCOUNT_STATUS_COPY.closed);
  } else if (input.status === "frozen") {
    notices.push(ACCOUNT_STATUS_COPY.frozen);
  } else if (input.status === "pending") {
    notices.push(ACCOUNT_STATUS_COPY.pendingReview);
  } else if (hasRestrictions) {
    notices.push(ACCOUNT_STATUS_COPY.restricted);
  } else if (!hasHolds) {
    notices.push(ACCOUNT_STATUS_COPY.activeGoodStanding);
  } else {
    notices.push("This account is active.");
  }

  if (input.restrictDeposits) notices.push(ACCOUNT_STATUS_COPY.depositRestricted);
  if (input.restrictWithdrawals) notices.push(ACCOUNT_STATUS_COPY.withdrawalRestricted);
  if (input.restrictTransfers) notices.push(ACCOUNT_STATUS_COPY.transferRestricted);
  if (hasHolds) notices.push(ACCOUNT_STATUS_COPY.fundsOnHold);

  const inGoodStanding =
    input.status === "active" && !hasRestrictions && !hasHolds;
  const hasIssues = !inGoodStanding;

  const headline = inGoodStanding
    ? ACCOUNT_STATUS_COPY.goodStanding
    : notices[0] ?? ACCOUNT_STATUS_COPY.goodStanding;

  return {
    accountStatus: input.status,
    restrictDeposits: input.restrictDeposits,
    restrictWithdrawals: input.restrictWithdrawals,
    restrictTransfers: input.restrictTransfers,
    heldFunds: input.heldFunds,
    pendingWithdrawals: input.pendingWithdrawals,
    inGoodStanding,
    hasIssues,
    headline,
    notices: inGoodStanding ? [ACCOUNT_STATUS_COPY.goodStanding] : dedupeNotices(notices),
  };
}

function dedupeNotices(notices: string[]): string[] {
  return [...new Set(notices)];
}

export function depositBlockedReason(status: CustomerAccountStatus): string | null {
  if (status.accountStatus === "closed") {
    return "This deposit couldn't be completed because this account is closed.";
  }
  if (status.accountStatus === "frozen") {
    return "Deposits are currently unavailable while this account is frozen.";
  }
  if (status.accountStatus === "pending") {
    return "Deposits are currently unavailable while this account is under review.";
  }
  if (status.restrictDeposits) {
    return ACCOUNT_STATUS_COPY.depositRestricted;
  }
  return null;
}

export function withdrawalBlockedReason(status: CustomerAccountStatus): string | null {
  if (status.accountStatus === "closed") {
    return "This withdrawal couldn't be completed because this account is closed.";
  }
  if (status.accountStatus === "frozen") {
    return "Withdrawals are currently unavailable while this account is frozen.";
  }
  if (status.accountStatus === "pending") {
    return "Withdrawals are currently unavailable while this account is under review.";
  }
  if (status.restrictWithdrawals) {
    return ACCOUNT_STATUS_COPY.withdrawalRestricted;
  }
  return null;
}

export function transferBlockedReason(
  status: CustomerAccountStatus,
  role: "source" | "destination" = "source",
): string | null {
  if (role === "source") {
    if (status.accountStatus === "closed") {
      return "This transfer couldn't be completed because this account is closed.";
    }
    if (status.accountStatus === "frozen") {
      return "This transfer couldn't be completed because this account is frozen.";
    }
    if (status.accountStatus === "pending") {
      return "This transfer couldn't be completed while this account is under review.";
    }
    if (status.restrictTransfers) {
      return "This transfer couldn't be completed because transfers are currently restricted on this account.";
    }
    return null;
  }

  if (status.accountStatus === "closed") {
    return "This transfer couldn't be completed because the destination account is closed.";
  }
  if (status.accountStatus === "frozen") {
    return "This transfer couldn't be completed because the destination account is frozen.";
  }
  if (status.accountStatus === "pending") {
    return "This transfer couldn't be completed because the destination account is under review.";
  }
  if (status.restrictDeposits) {
    return "This transfer couldn't be completed because deposits are currently restricted on the destination account.";
  }
  return null;
}

const SERVER_MESSAGE_MAP: Record<string, string> = {
  "Deposits are restricted on this account": ACCOUNT_STATUS_COPY.depositRestricted,
  "Deposits are currently unavailable for this account.": ACCOUNT_STATUS_COPY.depositRestricted,
  "Withdrawals are restricted on this account": ACCOUNT_STATUS_COPY.withdrawalRestricted,
  "Withdrawals are currently unavailable for this account.": ACCOUNT_STATUS_COPY.withdrawalRestricted,
  "Transfers are restricted on this account": ACCOUNT_STATUS_COPY.transferRestricted,
  "This transfer couldn't be completed because transfers are currently restricted on this account.":
    "This transfer couldn't be completed because transfers are currently restricted on this account.",
  "Account must be active to accept deposits":
    "This deposit couldn't be completed because this account is not active.",
  "This deposit couldn't be completed because this account is not active.":
    "This deposit couldn't be completed because this account is not active.",
  "Account must be active for withdrawals":
    "This withdrawal couldn't be completed because this account is not active.",
  "This withdrawal couldn't be completed because this account is not active.":
    "This withdrawal couldn't be completed because this account is not active.",
  "Source account must be active":
    "This transfer couldn't be completed because the source account is not active.",
  "This transfer couldn't be completed because the source account is not active.":
    "This transfer couldn't be completed because the source account is not active.",
  "Destination account must be active":
    "This transfer couldn't be completed because the destination account is not active.",
  "This transfer couldn't be completed because the destination account is not active.":
    "This transfer couldn't be completed because the destination account is not active.",
  "This transfer couldn't be completed because deposits are currently restricted on the destination account.":
    "This transfer couldn't be completed because deposits are currently restricted on the destination account.",
  "Account is closed": "This action couldn't be completed because this account is closed.",
  "Insufficient balance for this withdrawal":
    "This withdrawal couldn't be completed because your available balance is insufficient.",
  "This withdrawal couldn't be completed because your available balance is insufficient.":
    "This withdrawal couldn't be completed because your available balance is insufficient.",
  "Insufficient balance for this transfer":
    "This transfer couldn't be completed because your available balance is insufficient.",
  "This transfer couldn't be completed because your available balance is insufficient.":
    "This transfer couldn't be completed because your available balance is insufficient.",
  "Insufficient available balance in source account":
    "This payment couldn't be completed because your available balance is insufficient.",
  "This payment couldn't be completed because your available balance is insufficient.":
    "This payment couldn't be completed because your available balance is insufficient.",
  "Insufficient balance for this payment":
    "This payment couldn't be completed because your available balance is insufficient.",
  "Withdrawals are currently unavailable while this account is under review.":
    "Withdrawals are currently unavailable while this account is under review.",
};

export function formatBankActionError(
  rawMessage: string,
  context?: { action?: BankMoneyAction; accountId?: string },
): { message: string; accountId?: string } {
  const normalized = rawMessage.replace(/^BAD_REQUEST:/, "").trim();
  const mapped = SERVER_MESSAGE_MAP[normalized];

  if (mapped) {
    return { message: mapped, accountId: context?.accountId };
  }

  if (context?.action === "transfer" && /transfer/i.test(normalized)) {
    return {
      message: "This transfer couldn't be completed. Please review your account status and try again.",
      accountId: context.accountId,
    };
  }
  if (context?.action === "withdraw" && /withdraw/i.test(normalized)) {
    return {
      message: "This withdrawal couldn't be completed. Please review your account status and try again.",
      accountId: context.accountId,
    };
  }
  if (context?.action === "deposit" && /deposit/i.test(normalized)) {
    return {
      message: "This deposit couldn't be completed. Please review your account status and try again.",
      accountId: context.accountId,
    };
  }

  return { message: normalized, accountId: context?.accountId };
}

export function accountStatusBadgeLabel(status: CustomerAccountStatus): string {
  if (status.accountStatus === "closed") return "Closed";
  if (status.accountStatus === "frozen") return "Frozen";
  if (status.accountStatus === "pending") return "Under Review";
  if (
    status.restrictDeposits ||
    status.restrictWithdrawals ||
    status.restrictTransfers
  ) {
    return "Restricted";
  }
  if (status.heldFunds > 0) return "Funds on Hold";
  if (status.inGoodStanding) return "In Good Standing";
  return "Active";
}
