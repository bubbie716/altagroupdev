import type { BankRequestInProgress, UserBankAccount, UserBankTransaction } from "@/lib/bank/backend-types";
import type { ScheduledPaymentRow } from "@/lib/bank/business-banking-types";
import type {
  AltaPayScheduleRow,
  MerchantAutopayApprovalRow,
} from "@/lib/bank/payments-engine-types";

export type ActivityScheduledKind = "transfer" | "alta_pay";

/** Normalized scheduled/recurring instruction for Activity → Scheduled. */
export type ActivityScheduledInstruction = {
  id: string;
  kind: ActivityScheduledKind;
  title: string;
  destination: string;
  fundingLabel: string;
  bankAccountId: string | null;
  amount: number;
  status: string;
  statusLabel: string;
  paymentTypeLabel: string;
  frequencyLabel: string | null;
  nextRunDate: string | null;
  lastFailureReason: string | null;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  /** Intrabank cancel payload */
  transferScope?: "intrabank";
};

export type BankActivityCenterBundle = {
  accounts: UserBankAccount[];
  transactions: UserBankTransaction[];
  requests: BankRequestInProgress[];
  scheduled: ActivityScheduledInstruction[];
  autopay: MerchantAutopayApprovalRow[];
};

export function mapTransferSchedule(row: ScheduledPaymentRow): ActivityScheduledInstruction {
  const active = row.status === "approved" || row.status === "pending_review";
  return {
    id: row.id,
    kind: "transfer",
    title: row.label || "Intrabank transfer",
    destination: row.recipientName,
    fundingLabel: row.bankAccountId ? "Funding account" : "—",
    bankAccountId: row.bankAccountId,
    amount: row.amount,
    status: row.status,
    statusLabel: row.statusLabel,
    paymentTypeLabel: row.paymentTypeLabel,
    frequencyLabel: row.frequencyLabel,
    nextRunDate: row.nextRunDate ?? row.scheduledDate,
    lastFailureReason: row.lastFailureReason,
    canPause: false,
    canResume: false,
    canCancel: active || row.status === "paused",
    transferScope: "intrabank",
  };
}

export function mapAltaPaySchedule(row: AltaPayScheduleRow): ActivityScheduledInstruction {
  return {
    id: row.id,
    kind: "alta_pay",
    title: row.payeeLabel,
    destination: row.payeeLabel,
    fundingLabel: row.fundingAccountLabel,
    bankAccountId: row.bankAccountId,
    amount: row.amount,
    status: row.status,
    statusLabel: row.statusLabel,
    paymentTypeLabel: row.paymentTypeLabel,
    frequencyLabel: row.frequencyLabel,
    nextRunDate: row.nextRunDate ?? row.scheduledDate,
    lastFailureReason: row.lastFailureReason,
    canPause: row.status === "approved",
    canResume: row.status === "paused",
    canCancel: row.status === "approved" || row.status === "paused",
  };
}

export function filterActivityCenterByAccount<T extends { bankAccountId?: string | null }>(
  rows: T[],
  accountId: string | undefined,
): T[] {
  if (!accountId) return rows;
  return rows.filter((row) => row.bankAccountId === accountId);
}

export function filterAutopayByAccount(
  rows: MerchantAutopayApprovalRow[],
  accountId: string | undefined,
): MerchantAutopayApprovalRow[] {
  if (!accountId) return rows;
  return rows.filter((row) => {
    if (row.fundingSource.kind === "bank_account") {
      return row.fundingSource.accountId === accountId;
    }
    return false;
  });
}

export function findAuthorizedTransaction(
  rows: UserBankTransaction[],
  transactionId: string | undefined,
): UserBankTransaction | null {
  if (!transactionId) return null;
  return rows.find((row) => row.id === transactionId) ?? null;
}

export function findAuthorizedRequest(
  rows: BankRequestInProgress[],
  requestId: string | undefined,
): BankRequestInProgress | null {
  if (!requestId) return null;
  return rows.find((row) => row.id === requestId) ?? null;
}

export function findAuthorizedSchedule(
  rows: ActivityScheduledInstruction[],
  scheduleId: string | undefined,
): ActivityScheduledInstruction | null {
  if (!scheduleId) return null;
  return rows.find((row) => row.id === scheduleId) ?? null;
}

export function findAuthorizedAutopay(
  rows: MerchantAutopayApprovalRow[],
  approvalId: string | undefined,
): MerchantAutopayApprovalRow | null {
  if (!approvalId) return null;
  return rows.find((row) => row.id === approvalId) ?? null;
}

/** Pending deposit/withdrawal ops belong in Requests, not Activity history. */
export function isPendingMoneyRequestTransaction(tx: {
  type: string;
  status: string;
}): boolean {
  return tx.status === "pending" && (tx.type === "deposit" || tx.type === "withdrawal");
}
