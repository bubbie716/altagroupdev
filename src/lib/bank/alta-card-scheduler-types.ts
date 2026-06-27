export const ALTA_CARD_STATEMENTS_JOB_KEY = "ALTA_CARD_STATEMENTS";
export const ALTA_CARD_BILLING_JOB_KEY = "ALTA_CARD_BILLING";

export type AltaCardSchedulerJobFailure = {
  cardId?: string;
  statementId?: string;
  error: string;
};

export type AltaCardStatementSchedulerResult = {
  ok: boolean;
  trigger: "cron" | "manual";
  skipped: boolean;
  skipReason: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  cardsProcessed: number;
  statementsGenerated: number;
  successCount: number;
  failureCount: number;
  generatedCardIds: string[];
  failures: AltaCardSchedulerJobFailure[];
};

export type AltaCardBillingSchedulerResult = {
  ok: boolean;
  trigger: "cron" | "manual";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  cardsProcessed: number;
  overdueStatementsMarked: number;
  autopayDue: number;
  autopaySucceeded: number;
  autopayFailed: number;
  autopaySkipped: number;
  interestApplied: number;
  lateFeesApplied: number;
  successCount: number;
  failureCount: number;
  failures: AltaCardSchedulerJobFailure[];
  overdueMarked: string[];
  interest: { statementId: string; interestAmount: number }[];
  lateFees: { statementId: string; amount: number }[];
};

export type AltaCardSchedulerJobRunRow = {
  jobKey: string;
  label: string;
  lastStatus: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastMessage: string | null;
  summary: {
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    processedCount?: number;
    successCount?: number;
    failureCount?: number;
    errorSummary?: string | null;
  } | null;
};
