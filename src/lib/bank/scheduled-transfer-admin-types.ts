import type { ScheduledExecutionStatusCode, ScheduledPaymentStatusCode } from "@/lib/bank/business-banking-types";
import type { ExecuteDueScheduledTransfersResult } from "@/lib/bank/scheduled-transfer-executor";

export interface InternalScheduledTransferRow {
  id: string;
  label: string;
  amount: number;
  currency: string;
  status: ScheduledPaymentStatusCode;
  statusLabel: string;
  paymentType: string;
  transferScope: string;
  sourceAccountId: string;
  sourceAccountName: string;
  sourceAccountNumber: string;
  destinationAccountNumber: string | null;
  destinationName: string;
  ownerLabel: string;
  ownerType: "personal" | "company";
  companyId: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  consecutiveFailures: number;
  lastFailureReason: string | null;
  lastExecutionStatus: ScheduledExecutionStatusCode | null;
  lastExecutionStatusLabel: string | null;
  createdAt: string;
}

export type { ExecuteDueScheduledTransfersResult };
