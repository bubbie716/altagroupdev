import type {
  PaymentFrequency,
  ScheduledPayment,
  ScheduledPaymentType,
  ScheduledTransferExecutionStatus,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { isAccountAccessibleByUser, normalizeAccountNumber, submitInternalTransfer } from "@/server/bank.service";

const FAILURE_THRESHOLD = 3;

export interface ExecuteDueScheduledTransfersOptions {
  now?: Date;
  paymentIds?: string[];
  forceRun?: boolean;
}

export interface ExecuteDueScheduledTransfersResult {
  dueCount: number;
  executedCount: number;
  failedCount: number;
  skippedCount: number;
}

import { calculateNextRunDate as calculateNextRunDateInBankTz } from "@/lib/scheduled-datetime";

// #region agent log
function agentDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
) {
  const payload = {
    sessionId: "b92618",
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
  };
  fetch("http://127.0.0.1:7829/ingest/627124d8-5442-41f8-8b52-a7f340773672", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b92618" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

export function resolveScheduledRunAt(payment: Pick<ScheduledPayment, "paymentType" | "scheduledDate" | "nextRunDate">): Date | null {
  if (payment.paymentType === "RECURRING") {
    return payment.nextRunDate;
  }
  return payment.scheduledDate;
}

export function toFriendlyFailureReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const msg = raw.replace(/^BAD_REQUEST:/, "");

  if (/insufficient balance/i.test(msg)) {
    return "Skipped due to insufficient funds.";
  }
  if (/destination account must be active|recipient account not found|destination account unavailable/i.test(msg)) {
    return "Destination account unavailable.";
  }
  if (/source account must be active|account must be active|frozen/i.test(msg)) {
    return "Source account unavailable.";
  }
  if (/valid alta bank account number/i.test(msg)) {
    return "Destination account unavailable.";
  }
  if (/select a valid source account|select this account from the dropdown/i.test(msg)) {
    return "Transfer could not be completed.";
  }
  return "Transfer could not be completed.";
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function dueWhere(now: Date, paymentIds?: string[]) {
  const idFilter = paymentIds?.length ? { id: { in: paymentIds } } : {};

  return {
    transferScope: "INTRABANK" as const,
    status: "APPROVED" as const,
    ...idFilter,
    OR: [
      {
        paymentType: "RECURRING" as ScheduledPaymentType,
        nextRunDate: { lte: now },
      },
      {
        paymentType: { in: ["ONE_TIME", "SCHEDULED"] as ScheduledPaymentType[] },
        scheduledDate: { lte: now },
      },
    ],
  };
}

async function findOutTransactionId(referenceCode: string): Promise<string | null> {
  const tx = await prisma.bankTransaction.findUnique({
    where: { referenceCode: `${referenceCode}-OUT` },
    select: { id: true },
  });
  return tx?.id ?? null;
}

async function executeSinglePayment(
  payment: ScheduledPayment,
  scheduledRunAt: Date,
  now: Date,
): Promise<"executed" | "failed" | "skipped"> {
  let executionId: string | null = null;

  try {
    const execution = await prisma.scheduledTransferExecution.create({
      data: {
        scheduledPaymentId: payment.id,
        scheduledRunAt,
        status: "PENDING",
      },
    });
    executionId = execution.id;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await prisma.scheduledTransferExecution.findUnique({
        where: {
          scheduledPaymentId_scheduledRunAt: {
            scheduledPaymentId: payment.id,
            scheduledRunAt,
          },
        },
      });
      // #region agent log
      agentDebugLog(
        "scheduled-transfer-executor.service.ts:idempotency-skip",
        "Execution already exists — skipping",
        {
          paymentId: payment.id,
          scheduledRunAt: scheduledRunAt.toISOString(),
          existingStatus: existing?.status ?? null,
          existingFailureReason: existing?.failureReason ?? null,
        },
        "B",
      );
      // #endregion
      if (existing?.status === "EXECUTED") {
        return "skipped";
      }
      if (existing?.status === "PENDING") {
        const ageMs = now.getTime() - existing.createdAt.getTime();
        if (ageMs < 120_000) {
          return "skipped";
        }
        executionId = existing.id;
      } else if (existing?.status === "FAILED") {
        executionId = existing.id;
        await prisma.scheduledTransferExecution.update({
          where: { id: existing.id },
          data: { status: "PENDING", failureReason: null, executedAt: null },
        });
      } else {
        return "skipped";
      }
    }
    throw error;
  }

  const sourceAccount = await prisma.bankAccount.findUnique({
    where: { id: payment.bankAccountId },
  });
  if (!sourceAccount) {
    await recordFailure(payment, executionId, scheduledRunAt, now, "Source account unavailable.");
    return "failed";
  }
  if (sourceAccount.status !== "ACTIVE") {
    await recordFailure(payment, executionId, scheduledRunAt, now, "Source account unavailable.");
    return "failed";
  }

  if (!payment.recipientAccountNumber?.trim()) {
    await recordFailure(payment, executionId, scheduledRunAt, now, "Destination account unavailable.");
    return "failed";
  }

  const destinationNumber = normalizeAccountNumber(payment.recipientAccountNumber);
  const destinationAccount = await prisma.bankAccount.findUnique({
    where: { accountNumber: destinationNumber },
  });
  if (!destinationAccount || destinationAccount.status !== "ACTIVE") {
    await recordFailure(payment, executionId, scheduledRunAt, now, "Destination account unavailable.");
    return "failed";
  }

  const amount = Number(payment.amount.toString());
  const creatorHasDestination = await isAccountAccessibleByUser(destinationAccount.id, payment.createdByUserId);

  try {
    const { referenceCode } = await submitInternalTransfer(payment.createdByUserId, {
      fromAccountId: payment.bankAccountId,
      toAccountId: creatorHasDestination ? destinationAccount.id : undefined,
      toAccountNumber: creatorHasDestination ? undefined : destinationNumber,
      amount,
      memo: payment.memo ?? undefined,
    });

    const bankTransactionId = await findOutTransactionId(referenceCode);
    const executedAt = now;

    await prisma.$transaction(async (tx) => {
      await tx.scheduledTransferExecution.update({
        where: { id: executionId! },
        data: {
          status: "EXECUTED",
          bankTransactionId,
          executedAt,
          failureReason: null,
        },
      });

      const paymentUpdate: Prisma.ScheduledPaymentUpdateInput = {
        lastRunAt: executedAt,
        consecutiveFailures: 0,
        lastFailureReason: null,
        lastExecutionStatus: "EXECUTED",
      };

      if (payment.paymentType === "RECURRING" && payment.frequency) {
        paymentUpdate.nextRunDate = calculateNextRunDateInBankTz(payment.frequency, scheduledRunAt);
        paymentUpdate.status = "APPROVED";
      } else {
        paymentUpdate.status = "EXECUTED";
      }

      await tx.scheduledPayment.update({
        where: { id: payment.id },
        data: paymentUpdate,
      });
    });

    return "executed";
  } catch (error) {
    const reason = toFriendlyFailureReason(error);
    // #region agent log
    agentDebugLog(
      "scheduled-transfer-executor.service.ts:transfer-failed",
      "submitInternalTransfer failed",
      {
        paymentId: payment.id,
        reason,
        rawError: error instanceof Error ? error.message : String(error),
        fromAccountId: payment.bankAccountId,
        destinationNumber,
        creatorHasDestination,
        amount,
      },
      "D",
    );
    // #endregion
    await recordFailure(payment, executionId, scheduledRunAt, now, reason);
    return "failed";
  }
}

async function recordFailure(
  payment: ScheduledPayment,
  executionId: string,
  scheduledRunAt: Date,
  now: Date,
  reason: string,
): Promise<void> {
  const consecutiveFailures = payment.consecutiveFailures + 1;
  const shouldPause = consecutiveFailures >= FAILURE_THRESHOLD;

  await prisma.$transaction(async (tx) => {
    await tx.scheduledTransferExecution.update({
      where: { id: executionId },
      data: {
        status: "FAILED",
        failureReason: reason,
        executedAt: now,
      },
    });

    const paymentUpdate: Prisma.ScheduledPaymentUpdateInput = {
      lastRunAt: now,
      consecutiveFailures,
      lastFailureReason: reason,
      lastExecutionStatus: "FAILED",
    };

    if (payment.paymentType === "RECURRING" && payment.frequency) {
      paymentUpdate.nextRunDate = calculateNextRunDateInBankTz(payment.frequency, scheduledRunAt);
      paymentUpdate.status = shouldPause ? "PAUSED" : "APPROVED";
      if (shouldPause) {
        paymentUpdate.lastFailureReason = "Paused after repeated failures.";
      }
    } else {
      paymentUpdate.status = "FAILED";
    }

    await tx.scheduledPayment.update({
      where: { id: payment.id },
      data: paymentUpdate,
    });
  });
}

export async function executeDueScheduledTransfers(
  options: ExecuteDueScheduledTransfersOptions = {},
): Promise<ExecuteDueScheduledTransfersResult & { _debug?: Record<string, unknown> }> {
  const now = options.now ?? new Date();
  const payments = await prisma.scheduledPayment.findMany({
    where: dueWhere(now, options.paymentIds),
    orderBy: [{ scheduledDate: "asc" }, { nextRunDate: "asc" }],
  });

  const approvedIntrabank = await prisma.scheduledPayment.findMany({
    where: { transferScope: "INTRABANK", status: "APPROVED" },
    select: {
      id: true,
      status: true,
      paymentType: true,
      scheduledDate: true,
      nextRunDate: true,
      recipientAccountNumber: true,
    },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  // #region agent log
  agentDebugLog(
    "scheduled-transfer-executor.service.ts:executeDueScheduledTransfers",
    "Executor run started",
    {
      now: now.toISOString(),
      dueCount: payments.length,
      duePayments: payments.map((p) => ({
        id: p.id,
        status: p.status,
        paymentType: p.paymentType,
        scheduledDate: p.scheduledDate?.toISOString() ?? null,
        nextRunDate: p.nextRunDate?.toISOString() ?? null,
        recipientAccountNumber: p.recipientAccountNumber ? "set" : "missing",
      })),
      allApprovedIntrabank: approvedIntrabank.map((p) => ({
        id: p.id,
        paymentType: p.paymentType,
        scheduledDate: p.scheduledDate?.toISOString() ?? null,
        nextRunDate: p.nextRunDate?.toISOString() ?? null,
        isDueByScheduled: p.scheduledDate ? p.scheduledDate <= now : null,
        isDueByNext: p.nextRunDate ? p.nextRunDate <= now : null,
        recipientAccountNumber: p.recipientAccountNumber ? "set" : "missing",
      })),
    },
    "A",
  );
  // #endregion

  let executedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const outcomes: Array<{ paymentId: string; outcome: string; scheduledRunAt: string | null; reason?: string }> = [];

  for (const payment of payments) {
    const scheduledRunAt = resolveScheduledRunAt(payment);
    if (!scheduledRunAt) {
      skippedCount += 1;
      outcomes.push({ paymentId: payment.id, outcome: "skipped", scheduledRunAt: null, reason: "no_run_at" });
      continue;
    }

    if (!options.forceRun && !options.paymentIds && scheduledRunAt > now) {
      skippedCount += 1;
      outcomes.push({
        paymentId: payment.id,
        outcome: "skipped",
        scheduledRunAt: scheduledRunAt.toISOString(),
        reason: "run_at_in_future",
      });
      continue;
    }

    const outcome = await executeSinglePayment(payment, scheduledRunAt, now);
    outcomes.push({ paymentId: payment.id, outcome, scheduledRunAt: scheduledRunAt.toISOString() });
    if (outcome === "executed") executedCount += 1;
    else if (outcome === "failed") failedCount += 1;
    else skippedCount += 1;
  }

  // #region agent log
  agentDebugLog(
    "scheduled-transfer-executor.service.ts:executeDueScheduledTransfers-done",
    "Executor run finished",
    { executedCount, failedCount, skippedCount, outcomes },
    "A",
  );
  // #endregion

  return {
    dueCount: payments.length,
    executedCount,
    failedCount,
    skippedCount,
    _debug: { now: now.toISOString(), outcomes, approvedIntrabankCount: approvedIntrabank.length },
  };
}

export async function executeScheduledTransferNow(paymentId: string): Promise<ExecuteDueScheduledTransfersResult> {
  const payment = await prisma.scheduledPayment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    throw new Error("NOT_FOUND");
  }
  if (payment.transferScope !== "INTRABANK") {
    throw new Error("BAD_REQUEST:Only intrabank scheduled transfers can be executed automatically.");
  }
  if (!["APPROVED", "PAUSED"].includes(payment.status)) {
    throw new Error("BAD_REQUEST:Transfer is not eligible to run.");
  }

  const now = new Date();
  const scheduledRunAt = optionsRunAt(payment, now);

  if (payment.status === "PAUSED") {
    await prisma.scheduledPayment.update({
      where: { id: payment.id },
      data: { status: "APPROVED" },
    });
  }

  const freshPayment = await prisma.scheduledPayment.findUniqueOrThrow({ where: { id: paymentId } });
  const outcome = await executeSinglePayment(freshPayment, scheduledRunAt, now);

  return {
    dueCount: 1,
    executedCount: outcome === "executed" ? 1 : 0,
    failedCount: outcome === "failed" ? 1 : 0,
    skippedCount: outcome === "skipped" ? 1 : 0,
  };
}

function optionsRunAt(payment: ScheduledPayment, now: Date): Date {
  const dueAt = resolveScheduledRunAt(payment);
  if (dueAt && dueAt <= now) {
    return dueAt;
  }
  const minute = new Date(now);
  minute.setSeconds(0, 0);
  return minute;
}

export function mapExecutionStatusLabel(
  status: ScheduledTransferExecutionStatus | null | undefined,
): string | null {
  if (!status) return null;
  switch (status) {
    case "EXECUTED":
      return "Completed";
    case "FAILED":
      return "Failed";
    case "SKIPPED":
      return "Skipped";
    case "PENDING":
      return "Pending";
    default:
      return null;
  }
}
