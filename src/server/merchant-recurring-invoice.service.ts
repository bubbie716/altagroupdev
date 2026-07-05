import type { AltaUser } from "@/lib/auth/types";
import type {
  CreateRecurringInvoiceScheduleInput,
  RecurringInvoiceScheduleRow,
} from "@/lib/bank/payments-engine-types";
import { canManageMerchantInvoices } from "@/lib/auth/permissions";
import { calculateNextRunDate, DEFAULT_SCHEDULED_TIME_ET, parseBankScheduledDateTime } from "@/lib/scheduled-datetime";
import { isCommercialProActive } from "@/server/commercial-limits.service";
import { loadCommercialPlanSettings } from "@/server/commercial-plan.service";
import {
  FREQUENCY_LABELS,
  paymentFrequencyFromDb,
  toDbPaymentFrequency,
} from "@/server/business-banking-mapper";
import { getPaymentsEnginePlatformSettings } from "@/server/payments-engine-platform-settings.service";
import { prisma } from "@/server/db";
import type { MerchantRecurringInvoiceSchedule } from "@prisma/client";

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function mapSchedule(row: MerchantRecurringInvoiceSchedule & { recipientUser?: { discordUsername: string } | null; recipientCompany?: { name: string } | null }): RecurringInvoiceScheduleRow {
  const frequency = paymentFrequencyFromDb(row.frequency);
  const status = row.status === "ACTIVE" ? "active" : row.status === "PAUSED" ? "paused" : "cancelled";
  const recipientLabel =
    row.recipientCompany?.name ??
    row.recipientUser?.discordUsername ??
    "Recipient";
  return {
    id: row.id,
    templateName: row.templateName,
    recipientLabel,
    recipientUserId: row.recipientUserId,
    recipientCompanyId: row.recipientCompanyId,
    amount: decimalToNumber(row.amount),
    description: row.description,
    frequency,
    frequencyLabel: FREQUENCY_LABELS[frequency],
    dayOfMonth: row.dayOfMonth,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate?.toISOString() ?? null,
    autoSendEnabled: row.autoSendEnabled,
    status,
    statusLabel: status === "active" ? "Active" : status === "paused" ? "Paused" : "Cancelled",
    nextRunDate: row.nextRunDate?.toISOString() ?? null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    consecutiveFailures: row.consecutiveFailures,
    lastFailureReason: row.lastFailureReason,
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertRecurringInvoicePro(companyId: string) {
  const settings = await getPaymentsEnginePlatformSettings();
  if (!settings.recurringInvoicesRequirePro) return;
  const plan = await loadCommercialPlanSettings(companyId);
  if (!isCommercialProActive(plan)) {
    badRequest("Recurring invoice schedules require Alta Commercial Pro.");
  }
}

function requireManage(user: AltaUser, companyId: string) {
  if (!canManageMerchantInvoices(user, { companyId })) forbidden();
}

export async function listRecurringInvoiceSchedules(
  user: AltaUser,
  companyId: string,
): Promise<RecurringInvoiceScheduleRow[]> {
  requireManage(user, companyId);
  const rows = await prisma.merchantRecurringInvoiceSchedule.findMany({
    where: { merchantCompanyId: companyId, status: { not: "CANCELLED" } },
    include: {
      recipientUser: { select: { discordUsername: true } },
      recipientCompany: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapSchedule);
}

export async function createRecurringInvoiceSchedule(
  user: AltaUser,
  input: CreateRecurringInvoiceScheduleInput,
): Promise<RecurringInvoiceScheduleRow> {
  requireManage(user, input.companyId);
  await assertRecurringInvoicePro(input.companyId);
  if (input.amount <= 0) badRequest("Amount must be greater than zero.");
  if (!input.templateName.trim()) badRequest("Template name is required.");
  if (!input.description.trim()) badRequest("Description is required.");
  if (!input.recipientUserId && !input.recipientCompanyId) {
    badRequest("Select a recipient.");
  }
  if (!input.frequency) badRequest("Frequency is required.");

  const settings = await getPaymentsEnginePlatformSettings();
  if (!settings.allowedRecurringIntervals.includes(input.frequency)) {
    badRequest("This recurring interval is not allowed.");
  }

  const datePart = input.startDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) badRequest("Invalid start date.");

  const startDate = parseBankScheduledDateTime(datePart, DEFAULT_SCHEDULED_TIME_ET);
  const nextRunDate = startDate;

  const row = await prisma.merchantRecurringInvoiceSchedule.create({
    data: {
      merchantCompanyId: input.companyId,
      createdByUserId: user.id,
      templateName: input.templateName.trim(),
      recipientUserId: input.recipientUserId ?? null,
      recipientCompanyId: input.recipientCompanyId ?? null,
      amount: input.amount,
      description: input.description.trim(),
      frequency: toDbPaymentFrequency(input.frequency),
      dayOfMonth: input.dayOfMonth ?? null,
      startDate,
      endDate: input.endDate ? new Date(input.endDate) : null,
      autoSendEnabled: input.autoSendEnabled ?? true,
      nextRunDate,
    },
    include: {
      recipientUser: { select: { discordUsername: true } },
      recipientCompany: { select: { name: true } },
    },
  });

  const { recordMerchantRecurringInvoiceCreatedAudit } = await import("@/server/payments-engine-audit.service");
  await recordMerchantRecurringInvoiceCreatedAudit(user.id, row.id, row.templateName);
  return mapSchedule(row);
}

export async function pauseRecurringInvoiceSchedule(user: AltaUser, companyId: string, scheduleId: string) {
  requireManage(user, companyId);
  const row = await updateScheduleStatus(user, companyId, scheduleId, "PAUSED", "recordMerchantRecurringInvoicePausedAudit");
  return mapSchedule(row);
}

export async function cancelRecurringInvoiceSchedule(user: AltaUser, companyId: string, scheduleId: string) {
  requireManage(user, companyId);
  const row = await updateScheduleStatus(user, companyId, scheduleId, "CANCELLED", "recordMerchantRecurringInvoiceCancelledAudit");
  return mapSchedule(row);
}

async function updateScheduleStatus(
  user: AltaUser,
  companyId: string,
  scheduleId: string,
  status: "PAUSED" | "CANCELLED",
  auditFn: "recordMerchantRecurringInvoicePausedAudit" | "recordMerchantRecurringInvoiceCancelledAudit",
) {
  const existing = await prisma.merchantRecurringInvoiceSchedule.findFirst({
    where: { id: scheduleId, merchantCompanyId: companyId },
  });
  if (!existing) notFound();
  if (status === "PAUSED" && existing.status !== "ACTIVE") {
    badRequest("Only active schedules can be paused.");
  }
  if (status === "CANCELLED" && existing.status === "CANCELLED") {
    badRequest("This recurring invoice schedule is already deactivated.");
  }
  const row = await prisma.merchantRecurringInvoiceSchedule.update({
    where: { id: scheduleId },
    data: { status },
    include: {
      recipientUser: { select: { discordUsername: true } },
      recipientCompany: { select: { name: true } },
    },
  });
  const audit = await import("@/server/payments-engine-audit.service");
  await audit[auditFn](user.id, row.id, row.templateName);
  return row;
}

export async function executeDueRecurringInvoiceSchedules(options?: { now?: Date }): Promise<{
  dueCount: number;
  generatedCount: number;
  failedCount: number;
}> {
  const now = options?.now ?? new Date();
  const settings = await getPaymentsEnginePlatformSettings();
  const schedules = await prisma.merchantRecurringInvoiceSchedule.findMany({
    where: {
      status: "ACTIVE",
      nextRunDate: { lte: now },
    },
    include: {
      merchantCompany: { select: { name: true } },
      createdBy: true,
      recipientUser: { select: { discordUsername: true, minecraftUsername: true } },
      recipientCompany: { select: { name: true } },
    },
  });

  let generatedCount = 0;
  let failedCount = 0;

  for (const schedule of schedules) {
    if (schedule.endDate && schedule.endDate < now) {
      await prisma.merchantRecurringInvoiceSchedule.update({
        where: { id: schedule.id },
        data: { status: "CANCELLED" },
      });
      continue;
    }

    try {
      const user = await (await import("@/server/bank-account-access.service")).loadAltaUserOrThrow(
        schedule.createdByUserId,
      );
      const { createMerchantInvoiceDraft, sendMerchantInvoice } = await import(
        "@/server/merchant-invoice.service"
      );

      const dueDate = new Date(now.getTime() + 7 * 86_400_000);
      const invoice = await createMerchantInvoiceDraft(user, {
        companyId: schedule.merchantCompanyId,
        amount: decimalToNumber(schedule.amount),
        description: schedule.description,
        dueDate: dueDate.toISOString(),
        recipientUserId: schedule.recipientUserId ?? undefined,
        recipientCompanyId: schedule.recipientCompanyId ?? undefined,
      });

      await prisma.merchantInvoice.update({
        where: { id: invoice.id },
        data: {
          recurringScheduleId: schedule.id,
          isRecurring: true,
        },
      });

      if (schedule.autoSendEnabled) {
        await sendMerchantInvoice(user, schedule.merchantCompanyId, invoice.id, "recurring_schedule");
        const { tryAutopayAfterInvoiceSent } = await import("@/server/merchant-autopay.service");
        await tryAutopayAfterInvoiceSent(invoice.id);
      }

      const nextRun = calculateNextRunDate(schedule.frequency, schedule.nextRunDate ?? now);
      await prisma.merchantRecurringInvoiceSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunDate: nextRun,
          consecutiveFailures: 0,
          lastFailureReason: null,
        },
      });

      const { recordMerchantRecurringInvoiceGeneratedAudit } = await import(
        "@/server/payments-engine-audit.service"
      );
      await recordMerchantRecurringInvoiceGeneratedAudit(schedule.createdByUserId, schedule.id, invoice.id);
      generatedCount += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Generation failed.";
      const failures = schedule.consecutiveFailures + 1;
      await prisma.merchantRecurringInvoiceSchedule.update({
        where: { id: schedule.id },
        data: {
          consecutiveFailures: failures,
          lastFailureReason: reason,
          ...(failures >= settings.maxFailedAttemptsBeforeDisableSchedule ? { status: "PAUSED" } : {}),
        },
      });
      const { recordMerchantRecurringInvoiceFailedAudit } = await import("@/server/payments-engine-audit.service");
      await recordMerchantRecurringInvoiceFailedAudit(schedule.createdByUserId, schedule.id, reason);

      const recipientLabel = schedule.recipientCompany
        ? schedule.recipientCompany.name
        : schedule.recipientUser
          ? schedule.recipientUser.minecraftUsername?.trim() || schedule.recipientUser.discordUsername
          : null;

      const { notifyMerchantRecurringInvoiceFailedBestEffort } = await import(
        "@/server/commercial-notification.service"
      );
      await notifyMerchantRecurringInvoiceFailedBestEffort({
        companyId: schedule.merchantCompanyId,
        scheduleId: schedule.id,
        templateName: schedule.templateName,
        recipientLabel,
        reason,
      });

      failedCount += 1;
    }
  }

  return { dueCount: schedules.length, generatedCount, failedCount };
}

export async function getRecurringInvoiceAnalytics(companyId: string) {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [activeSchedules, pausedSchedules, cancelledThisMonth, generatedThisMonth, paidThisMonth, failedSchedules] =
    await Promise.all([
      prisma.merchantRecurringInvoiceSchedule.count({
        where: { merchantCompanyId: companyId, status: "ACTIVE" },
      }),
      prisma.merchantRecurringInvoiceSchedule.count({
        where: { merchantCompanyId: companyId, status: "PAUSED" },
      }),
      prisma.merchantRecurringInvoiceSchedule.count({
        where: {
          merchantCompanyId: companyId,
          status: "CANCELLED",
          updatedAt: { gte: monthStart },
        },
      }),
      prisma.merchantInvoice.count({
        where: {
          merchantCompanyId: companyId,
          isRecurring: true,
          createdAt: { gte: monthStart },
        },
      }),
      prisma.merchantInvoice.aggregate({
        where: {
          merchantCompanyId: companyId,
          isRecurring: true,
          status: "PAID",
          paidAt: { gte: monthStart },
        },
        _sum: { amountPaid: true },
      }),
      prisma.merchantRecurringInvoiceSchedule.count({
        where: { merchantCompanyId: companyId, consecutiveFailures: { gt: 0 } },
      }),
    ]);

  return {
    activeSchedules,
    pausedSchedules,
    cancelledThisMonth,
    generatedThisMonth,
    recurringRevenueThisMonth: decimalToNumber(paidThisMonth._sum.amountPaid ?? { toString: () => "0" }),
    failedSchedules,
  };
}
