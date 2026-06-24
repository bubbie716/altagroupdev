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

export function calculateNextRunDate(frequency: PaymentFrequency, from: Date): Date {
  const next = new Date(from);
  switch (frequency) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
  }
  return next;
}

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
      if (existing?.status === "EXECUTED" || existing?.status === "PENDING") {
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
        paymentUpdate.nextRunDate = calculateNextRunDate(payment.frequency, scheduledRunAt);
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
      paymentUpdate.nextRunDate = calculateNextRunDate(payment.frequency, scheduledRunAt);
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
): Promise<ExecuteDueScheduledTransfersResult> {
  const now = options.now ?? new Date();
  const payments = await prisma.scheduledPayment.findMany({
    where: dueWhere(now, options.paymentIds),
    orderBy: [{ scheduledDate: "asc" }, { nextRunDate: "asc" }],
  });

  let executedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const payment of payments) {
    const scheduledRunAt = resolveScheduledRunAt(payment);
    if (!scheduledRunAt) {
      skippedCount += 1;
      continue;
    }

    if (!options.forceRun && !options.paymentIds && scheduledRunAt > now) {
      skippedCount += 1;
      continue;
    }

    const outcome = await executeSinglePayment(payment, scheduledRunAt, now);
    if (outcome === "executed") executedCount += 1;
    else if (outcome === "failed") failedCount += 1;
    else skippedCount += 1;
  }

  return {
    dueCount: payments.length,
    executedCount,
    failedCount,
    skippedCount,
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
