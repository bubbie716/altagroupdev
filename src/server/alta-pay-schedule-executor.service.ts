import type { ScheduledPayment } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { calculateNextRunDate } from "@/lib/scheduled-datetime";
import { parsePaymentEngineFundingSource } from "@/server/payment-engine-funding.service";
import { resolveScheduledRunAt } from "@/server/scheduled-transfer-executor.service";
import { getPaymentsEnginePlatformSettings } from "@/server/payments-engine-platform-settings.service";
import { prisma } from "@/server/db";
import { loadAltaUserOrThrow } from "@/server/bank-account-access.service";

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function dueAltaPayWhere(now: Date) {
  return {
    paymentChannel: "ALTA_PAY" as const,
    status: "APPROVED" as const,
    OR: [
      {
        paymentType: "RECURRING" as const,
        nextRunDate: { lte: now },
      },
      {
        paymentType: "SCHEDULED" as const,
        scheduledDate: { lte: now },
      },
    ],
  };
}

export async function executeDueAltaPaySchedules(options?: {
  now?: Date;
}): Promise<{ dueCount: number; executedCount: number; failedCount: number; skippedCount: number }> {
  const now = options?.now ?? new Date();
  const settings = await getPaymentsEnginePlatformSettings();
  const payments = await prisma.scheduledPayment.findMany({
    where: dueAltaPayWhere(now),
    orderBy: { createdAt: "asc" },
  });

  let executedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const payment of payments) {
    const result = await executeSingleAltaPaySchedule(payment, now, settings.defaultRetryCount, settings.defaultRetryDelayMinutes);
    if (result === "executed") executedCount += 1;
    else if (result === "failed") failedCount += 1;
    else skippedCount += 1;
  }

  return { dueCount: payments.length, executedCount, failedCount, skippedCount };
}

async function executeSingleAltaPaySchedule(
  payment: ScheduledPayment,
  now: Date,
  maxRetries: number,
  retryDelayMinutes: number,
): Promise<"executed" | "failed" | "skipped"> {
  const scheduledRunAt = resolveScheduledRunAt(payment);
  if (!scheduledRunAt) return "skipped";

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
      if (existing?.status === "EXECUTED") return "skipped";
      if (existing?.status === "PENDING") return "skipped";
      if (existing?.status === "FAILED" && existing.retryCount >= maxRetries) return "skipped";
      if (existing) {
        executionId = existing.id;
        if (existing.nextRetryAt && existing.nextRetryAt > now) return "skipped";
        await prisma.scheduledTransferExecution.update({
          where: { id: existing.id },
          data: { status: "PENDING", failureReason: null },
        });
      } else {
        return "skipped";
      }
    } else {
      throw error;
    }
  }

  const fundingSource = parsePaymentEngineFundingSource(payment.fundingSource, payment.bankAccountId);
  if (!fundingSource) {
    await recordScheduleFailure(
      payment,
      executionId,
      scheduledRunAt,
      now,
      "Funding source unavailable.",
      maxRetries,
      retryDelayMinutes,
    );
    return "failed";
  }

  if (fundingSource.kind === "bank_account") {
    const sourceAccount = await prisma.bankAccount.findUnique({
      where: { id: fundingSource.accountId },
    });
    if (!sourceAccount || sourceAccount.status !== "ACTIVE") {
      await recordScheduleFailure(
        payment,
        executionId,
        scheduledRunAt,
        now,
        "Source account unavailable.",
        maxRetries,
        retryDelayMinutes,
      );
      return "failed";
    }
  }

  try {
    const user = await loadAltaUserOrThrow(payment.createdByUserId);
    const memo = payment.memo ?? undefined;
    const amount = Number(payment.amount.toString());

    let referenceCode: string;
    if (payment.recipientCompanyId) {
      const { submitAltaPayPayment } = await import("@/server/alta-pay.service");
      const result = await submitAltaPayPayment(
        user,
        { fundingSource, companyId: payment.recipientCompanyId, amount, memo },
        { source: "scheduled" },
      );
      referenceCode = result.referenceCode;
    } else if (payment.recipientUserId) {
      if (fundingSource.kind !== "bank_account") {
        await recordScheduleFailure(
          payment,
          executionId,
          scheduledRunAt,
          now,
          "Alta Card funding is not available for person-to-person scheduled payments.",
          maxRetries,
          retryDelayMinutes,
        );
        return "failed";
      }
      const { submitAltaPayToPerson } = await import("@/server/alta-pay.service");
      const result = await submitAltaPayToPerson(
        user,
        {
          fundingSource,
          recipientUserId: payment.recipientUserId,
          amount,
          memo,
        },
        { source: "scheduled" },
      );
      referenceCode = result.referenceCode;
    } else {
      await recordScheduleFailure(
        payment,
        executionId,
        scheduledRunAt,
        now,
        "Payee unavailable.",
        maxRetries,
        retryDelayMinutes,
      );
      return "failed";
    }

    let bankTransactionId: string | null = null;
    if (fundingSource.kind === "bank_account") {
      const outTx = await prisma.bankTransaction.findFirst({
        where: { referenceCode: `${referenceCode}-OUT` },
        select: { id: true },
      });
      bankTransactionId = outTx?.id ?? null;
    } else {
      const cardTx = await prisma.altaCardTransaction.findFirst({
        where: { relatedAltaPayPaymentId: referenceCode },
        select: { id: true },
      });
      bankTransactionId = cardTx?.id ?? null;
    }

    await prisma.$transaction(async (tx) => {
      await tx.scheduledTransferExecution.update({
        where: { id: executionId! },
        data: {
          status: "EXECUTED",
          executedAt: now,
          bankTransactionId,
          failureReason: null,
        },
      });

      if (payment.paymentType === "RECURRING" && payment.frequency) {
        const nextRun = calculateNextRunDate(payment.frequency, scheduledRunAt);
        await tx.scheduledPayment.update({
          where: { id: payment.id },
          data: {
            lastRunAt: now,
            nextRunDate: nextRun,
            consecutiveFailures: 0,
            lastFailureReason: null,
            lastExecutionStatus: "EXECUTED",
          },
        });
      } else {
        await tx.scheduledPayment.update({
          where: { id: payment.id },
          data: {
            status: "EXECUTED",
            lastRunAt: now,
            consecutiveFailures: 0,
            lastFailureReason: null,
            lastExecutionStatus: "EXECUTED",
          },
        });
      }
    });

    const { recordPaymentScheduleExecutedAudit } = await import("@/server/payments-engine-audit.service");
    const { notifyPaymentScheduleExecutedBestEffort } = await import(
      "@/server/payments-engine-notification.service"
    );
    await recordPaymentScheduleExecutedAudit(payment.createdByUserId, payment, referenceCode);
    await notifyPaymentScheduleExecutedBestEffort(payment.createdByUserId, payment, amount);

    return "executed";
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message.replace(/^BAD_REQUEST:/, "")
        : "Payment could not be completed.";
    await recordScheduleFailure(payment, executionId, scheduledRunAt, now, reason, maxRetries, retryDelayMinutes);
    return "failed";
  }
}

async function recordScheduleFailure(
  payment: ScheduledPayment,
  executionId: string | null,
  scheduledRunAt: Date,
  now: Date,
  reason: string,
  maxRetries: number,
  retryDelayMinutes: number,
) {
  const settings = await getPaymentsEnginePlatformSettings();
  const failures = payment.consecutiveFailures + 1;
  const retryCount = await prisma.scheduledTransferExecution.findUnique({
    where: executionId ? { id: executionId } : { scheduledPaymentId_scheduledRunAt: { scheduledPaymentId: payment.id, scheduledRunAt } },
    select: { retryCount: true },
  });
  const nextRetry = (retryCount?.retryCount ?? 0) + 1;
  const canRetry = nextRetry < maxRetries;
  const nextRetryAt = canRetry ? new Date(now.getTime() + retryDelayMinutes * 60_000) : null;
  const pauseSchedule = failures >= settings.maxFailedAttemptsBeforeDisableSchedule;

  await prisma.$transaction(async (tx) => {
    if (executionId) {
      await tx.scheduledTransferExecution.update({
        where: { id: executionId },
        data: {
          status: "FAILED",
          failureReason: reason,
          retryCount: nextRetry,
          nextRetryAt,
        },
      });
    }

    await tx.scheduledPayment.update({
      where: { id: payment.id },
      data: {
        consecutiveFailures: failures,
        lastFailureReason: reason,
        lastExecutionStatus: "FAILED",
        lastRunAt: now,
        ...(pauseSchedule
          ? { status: payment.paymentType === "RECURRING" ? "PAUSED" : "FAILED" }
          : {}),
        ...(payment.paymentType === "SCHEDULED" && !canRetry ? { status: "FAILED" } : {}),
      },
    });
  });

  const { recordPaymentScheduleFailedAudit } = await import("@/server/payments-engine-audit.service");
  const { notifyPaymentScheduleFailedBestEffort } = await import(
    "@/server/payments-engine-notification.service"
  );
  await recordPaymentScheduleFailedAudit(payment.createdByUserId, payment, reason);
  await notifyPaymentScheduleFailedBestEffort(payment.createdByUserId, payment, reason, !canRetry);
}
