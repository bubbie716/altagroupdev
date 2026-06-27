type OpsJobRunSummary = {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  errorSummary?: string | null;
  details?: Record<string, unknown>;
};

function parseOpsJobRunMessage(lastMessage: string | null | undefined): OpsJobRunSummary | null {
  if (!lastMessage?.trim()) return null;
  if (!lastMessage.trimStart().startsWith("{")) return null;
  try {
    return JSON.parse(lastMessage) as OpsJobRunSummary;
  } catch {
    return null;
  }
}

function formatPeriod(start?: unknown, end?: unknown): string | null {
  if (typeof start !== "string" || typeof end !== "string") return null;
  return `${start.slice(0, 10)} – ${end.slice(0, 10)}`;
}

function formatBankAccountStatementsDetail(summary: OpsJobRunSummary): string {
  const details = summary.details ?? {};
  if (details.skipped === true) {
    const period = formatPeriod(details.periodStart, details.periodEnd);
    const reason = summary.errorSummary ?? "Skipped · runs on the 1st of each month";
    return period ? `${reason} · period ${period}` : reason;
  }

  const skippedExisting =
    typeof details.skippedCount === "number" ? details.skippedCount : undefined;
  const period = formatPeriod(details.periodStart, details.periodEnd);
  const parts = [
    `${summary.successCount} generated`,
    skippedExisting != null ? `${skippedExisting} skipped existing` : null,
    summary.failureCount > 0 ? `${summary.failureCount} failed` : null,
  ].filter(Boolean);

  const line = parts.join(" · ");
  return period ? `${line} · ${period}` : line;
}

function formatAltaCardStatementsDetail(summary: OpsJobRunSummary): string {
  const details = summary.details ?? {};
  if (details.skipped === true) {
    return summary.errorSummary ?? "Skipped · runs on the last calendar day of the month";
  }

  const generated =
    typeof details.statementsGenerated === "number"
      ? details.statementsGenerated
      : summary.successCount;
  const parts = [
    `${generated} generated`,
    summary.processedCount > 0 ? `${summary.processedCount} cards processed` : null,
    summary.failureCount > 0 ? `${summary.failureCount} failed` : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

function formatAltaCardBillingDetail(summary: OpsJobRunSummary): string {
  const details = summary.details ?? {};
  const overdue = typeof details.overdueStatementsMarked === "number" ? details.overdueStatementsMarked : 0;
  const autopaySucceeded =
    typeof details.autopaySucceeded === "number" ? details.autopaySucceeded : 0;
  const autopayFailed = typeof details.autopayFailed === "number" ? details.autopayFailed : 0;
  const interest = typeof details.interestApplied === "number" ? details.interestApplied : 0;
  const lateFees = typeof details.lateFeesApplied === "number" ? details.lateFeesApplied : 0;

  if (summary.failureCount > 0) {
    const base = `${summary.failureCount} failed`;
    return summary.errorSummary ? `${base} · ${summary.errorSummary}` : base;
  }

  if (overdue === 0 && interest === 0 && lateFees === 0 && autopaySucceeded === 0 && summary.processedCount === 0) {
    return "No billing actions required";
  }

  return [
    autopaySucceeded > 0 ? `${autopaySucceeded} autopay succeeded` : null,
    autopayFailed > 0 ? `${autopayFailed} autopay failed` : null,
    overdue > 0 ? `${overdue} overdue` : null,
    interest > 0 ? `${interest} interest posted` : null,
    lateFees > 0 ? `${lateFees} late fees` : null,
    summary.processedCount > 0 ? `${summary.processedCount} cards processed` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatDepositInterestDetail(summary: OpsJobRunSummary): string {
  const details = summary.details ?? {};
  const accrualProcessed =
    typeof details.depositAccrualProcessed === "number" ? details.depositAccrualProcessed : 0;
  const scheduledApplied =
    typeof details.scheduledManualApplied === "number" ? details.scheduledManualApplied : 0;
  const scheduledDue =
    typeof details.scheduledManualDue === "number" ? details.scheduledManualDue : 0;

  if (summary.failureCount > 0) {
    const base = `${summary.failureCount} failed`;
    return summary.errorSummary ? `${base} · ${summary.errorSummary}` : base;
  }

  if (accrualProcessed === 0 && scheduledApplied === 0 && scheduledDue === 0) {
    return "No deposit interest due";
  }

  return [
    accrualProcessed > 0 ? `${accrualProcessed} accounts accrued` : null,
    scheduledDue > 0 ? `${scheduledApplied}/${scheduledDue} scheduled manual applied` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatGenericJobDetail(summary: OpsJobRunSummary): string {
  const details = summary.details ?? {};
  if (details.skipped === true) {
    return summary.errorSummary ?? "Skipped";
  }

  const parts = [
    summary.successCount > 0 ? `${summary.successCount} succeeded` : null,
    summary.failureCount > 0 ? `${summary.failureCount} failed` : null,
    summary.processedCount > 0 && summary.successCount !== summary.processedCount
      ? `${summary.processedCount} processed`
      : null,
  ].filter(Boolean);

  const line = parts.length > 0 ? parts.join(" · ") : "Last run completed";
  return summary.errorSummary ? `${line} · ${summary.errorSummary}` : line;
}

export function formatOpsJobRunHealthDetail(
  jobKey: string,
  lastMessage: string | null | undefined,
  fallback: string,
): string {
  if (!lastMessage?.trim()) return fallback;

  const summary = parseOpsJobRunMessage(lastMessage);
  if (!summary) return lastMessage;

  switch (jobKey) {
    case "BANK_ACCOUNT_STATEMENTS":
      return formatBankAccountStatementsDetail(summary);
    case "ALTA_CARD_STATEMENTS":
      return formatAltaCardStatementsDetail(summary);
    case "ALTA_CARD_BILLING":
      return formatAltaCardBillingDetail(summary);
    case "deposit_interest":
      return formatDepositInterestDetail(summary);
    default:
      return formatGenericJobDetail(summary);
  }
}
