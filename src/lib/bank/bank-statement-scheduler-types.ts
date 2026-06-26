export const BANK_ACCOUNT_STATEMENTS_JOB_KEY = "BANK_ACCOUNT_STATEMENTS";

export type BankStatementSchedulerFailure = {
  accountId: string;
  error: string;
};

export type BankStatementSchedulerResult = {
  ok: boolean;
  trigger: "cron" | "manual";
  skipped: boolean;
  skipReason: string | null;
  periodStart: string;
  periodEnd: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  eligibleAccounts: number;
  statementsGenerated: number;
  skippedExisting: number;
  failed: number;
  failures: BankStatementSchedulerFailure[];
};

export type BankStatementSchedulerJobRunRow = {
  jobKey: string;
  label: string;
  lastStatus: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  summary: {
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    processedCount?: number;
    successCount?: number;
    skippedCount?: number;
    failureCount?: number;
    periodStart?: string;
    periodEnd?: string;
    errorSummary?: string | null;
  } | null;
};
