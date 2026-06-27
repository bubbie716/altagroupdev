import type { ManualInterestApplicationInput, ManualInterestApplyResult } from "@/lib/bank/manual-interest-types";

export type ScheduledManualInterestStatus = "PENDING" | "APPLIED" | "CANCELLED" | "FAILED";

export interface ScheduledManualInterestRow {
  id: string;
  status: ScheduledManualInterestStatus;
  scheduledFor: string;
  reason: string;
  mode: ManualInterestApplicationInput["mode"];
  categoryLabels: string[];
  createdByUsername: string;
  createdAt: string;
  batchReferenceId: string | null;
  failureReason: string | null;
}

export interface ScheduleManualInterestResult {
  scheduled: true;
  id: string;
  scheduledFor: string;
  idempotencyKey: string;
}

export interface ExecuteScheduledManualInterestResult {
  dueCount: number;
  appliedCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface DepositInterestSchedulerResult {
  depositAccrual: {
    processedCount: number;
    skippedCount: number;
    failedCount: number;
    totalInterestCredited: number;
  };
  scheduledManualInterest: ExecuteScheduledManualInterestResult;
}

export type StoredManualInterestPayload = ManualInterestApplicationInput;

export type { ManualInterestApplyResult };
