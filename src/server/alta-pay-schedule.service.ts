import type { AltaUser } from "@/lib/auth/types";
import type {
  AltaPayScheduleRow,
  CreateAltaPayScheduleInput,
} from "@/lib/bank/payments-engine-types";
import { resolveScheduledInputDateTime } from "@/lib/scheduled-datetime";
import {
  assertPaymentEngineFundingSource,
  parsePaymentEngineFundingSource,
  paymentEngineFundingLabel,
} from "@/server/payment-engine-funding.service";
import {
  FREQUENCY_LABELS,
  paymentFrequencyFromDb,
  toDbPaymentFrequency,
} from "@/server/business-banking-mapper";
import { getPaymentsEnginePlatformSettings } from "@/server/payments-engine-platform-settings.service";
import { prisma } from "@/server/db";
import type { ScheduledPayment, ScheduledPaymentStatus } from "@prisma/client";

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function mapStatus(status: ScheduledPaymentStatus): AltaPayScheduleRow["status"] {
  if (status === "APPROVED") return "approved";
  if (status === "EXECUTED") return "executed";
  if (status === "CANCELLED") return "cancelled";
  if (status === "PAUSED") return "paused";
  return "failed";
}

const STATUS_LABELS: Record<AltaPayScheduleRow["status"], string> = {
  approved: "Active",
  executed: "Completed",
  cancelled: "Cancelled",
  paused: "Paused",
  failed: "Failed",
};

export function mapAltaPayScheduleRow(
  row: ScheduledPayment & {
    bankAccount?: { accountName: string } | null;
    fundingSource?: unknown;
  },
): AltaPayScheduleRow {
  const paymentType = row.paymentType === "RECURRING" ? "recurring" : "scheduled";
  const frequency = row.frequency ? paymentFrequencyFromDb(row.frequency) : null;
  const status = mapStatus(row.status);
  const fundingSource =
    parsePaymentEngineFundingSource(row.fundingSource, row.bankAccountId) ??
    ({ kind: "bank_account", accountId: row.bankAccountId ?? "" } as const);
  return {
    id: row.id,
    paymentType,
    paymentTypeLabel: paymentType === "recurring" ? "Recurring" : "Scheduled",
    payeeLabel: row.recipientName,
    recipientCompanyId: row.recipientCompanyId,
    recipientUserId: row.recipientUserId,
    amount: decimalToNumber(row.amount),
    frequency,
    frequencyLabel: frequency ? FREQUENCY_LABELS[frequency] : null,
    scheduledDate: row.scheduledDate?.toISOString() ?? null,
    nextRunDate: row.nextRunDate?.toISOString() ?? null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    status,
    statusLabel: STATUS_LABELS[status],
    memo: row.memo,
    bankAccountId: row.bankAccountId,
    fundingSource,
    fundingAccountLabel:
      fundingSource.kind === "bank_account"
        ? (row.bankAccount?.accountName ?? "Account")
        : paymentEngineFundingLabel(fundingSource),
    consecutiveFailures: row.consecutiveFailures,
    lastFailureReason: row.lastFailureReason,
    createdAt: row.createdAt.toISOString(),
  };
}

async function validateScheduleInput(user: AltaUser, input: CreateAltaPayScheduleInput) {
  if (input.amount <= 0) badRequest("Amount must be greater than zero.");
  if (!input.recipientCompanyId && !input.recipientUserId) {
    badRequest("Select a payee.");
  }
  if (input.recipientCompanyId && input.recipientUserId) {
    badRequest("Select either a company or a person, not both.");
  }

  if (input.fundingSource.kind === "alta_card" && input.recipientUserId) {
    badRequest("Scheduled Alta Card payments can only be sent to verified companies.");
  }

  const merchantCompanyId = input.recipientCompanyId ?? undefined;
  await assertPaymentEngineFundingSource(user, input.fundingSource, { merchantCompanyId });

  const scheduledDate = resolveScheduledInputDateTime(input.scheduledDate, input.scheduledTime);
  if (!scheduledDate) badRequest("Scheduled date and time are required.");

  const settings = await getPaymentsEnginePlatformSettings();
  const maxFuture = new Date();
  maxFuture.setUTCDate(maxFuture.getUTCDate() + settings.maxScheduledPaymentFutureDays);
  if (scheduledDate > maxFuture) {
    badRequest(
      `Scheduled payments cannot be more than ${settings.maxScheduledPaymentFutureDays} days in the future.`,
    );
  }
  if (scheduledDate <= new Date()) {
    badRequest("Scheduled date must be in the future.");
  }

  if (input.paymentType === "recurring") {
    if (!input.frequency) badRequest("Frequency is required for recurring payments.");
    if (!settings.allowedRecurringIntervals.includes(input.frequency)) {
      badRequest("This recurring interval is not allowed.");
    }
  }

  if (input.recipientCompanyId) {
    const company = await prisma.company.findUnique({ where: { id: input.recipientCompanyId } });
    if (!company || company.verificationStatus !== "VERIFIED") {
      badRequest("Company is not available for Alta Pay.");
    }
  }

  return scheduledDate;
}

export async function listAltaPaySchedules(user: AltaUser): Promise<AltaPayScheduleRow[]> {
  const rows = await prisma.scheduledPayment.findMany({
    where: {
      createdByUserId: user.id,
      companyId: null,
      paymentChannel: "ALTA_PAY",
      status: { notIn: ["REJECTED", "PENDING_REVIEW"] },
    },
    include: { bankAccount: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapAltaPayScheduleRow);
}

export async function createAltaPaySchedule(
  user: AltaUser,
  input: CreateAltaPayScheduleInput,
): Promise<AltaPayScheduleRow> {
  const scheduledDate = await validateScheduleInput(user, input);

  const row = await prisma.scheduledPayment.create({
    data: {
      companyId: null,
      bankAccountId:
        input.fundingSource.kind === "bank_account" ? input.fundingSource.accountId : null,
      fundingSource: input.fundingSource,
      createdByUserId: user.id,
      transferScope: "INTRABANK",
      paymentChannel: "ALTA_PAY",
      paymentType: input.paymentType === "recurring" ? "RECURRING" : "SCHEDULED",
      label: input.payeeLabel.trim(),
      recipientName: input.payeeLabel.trim(),
      recipientCompanyId: input.recipientCompanyId ?? null,
      recipientUserId: input.recipientUserId ?? null,
      amount: input.amount,
      frequency: input.frequency ? toDbPaymentFrequency(input.frequency) : null,
      scheduledDate,
      nextRunDate: input.paymentType === "recurring" ? scheduledDate : null,
      memo: input.memo?.trim() || null,
      status: "APPROVED",
    },
    include: { bankAccount: true },
  });

  const { recordPaymentScheduleCreatedAudit } = await import("@/server/payments-engine-audit.service");
  const { notifyPaymentScheduleCreatedBestEffort } = await import(
    "@/server/payments-engine-notification.service"
  );
  await recordPaymentScheduleCreatedAudit(user.id, row);
  void notifyPaymentScheduleCreatedBestEffort(user.id, mapAltaPayScheduleRow(row));

  return mapAltaPayScheduleRow(row);
}

export async function pauseAltaPaySchedule(user: AltaUser, scheduleId: string): Promise<AltaPayScheduleRow> {
  const existing = await findOwnedSchedule(user, scheduleId);
  if (existing.status !== "APPROVED") badRequest("Only active schedules can be paused.");
  const row = await prisma.scheduledPayment.update({
    where: { id: scheduleId },
    data: { status: "PAUSED" },
    include: { bankAccount: true },
  });
  const { recordPaymentRecurringPausedAudit } = await import("@/server/payments-engine-audit.service");
  await recordPaymentRecurringPausedAudit(user.id, row);
  return mapAltaPayScheduleRow(row);
}

export async function resumeAltaPaySchedule(user: AltaUser, scheduleId: string): Promise<AltaPayScheduleRow> {
  const existing = await findOwnedSchedule(user, scheduleId);
  if (existing.status !== "PAUSED") badRequest("Only paused schedules can be resumed.");
  const row = await prisma.scheduledPayment.update({
    where: { id: scheduleId },
    data: { status: "APPROVED", consecutiveFailures: 0, lastFailureReason: null },
    include: { bankAccount: true },
  });
  const { recordPaymentRecurringResumedAudit } = await import("@/server/payments-engine-audit.service");
  await recordPaymentRecurringResumedAudit(user.id, row);
  return mapAltaPayScheduleRow(row);
}

export async function cancelAltaPaySchedule(user: AltaUser, scheduleId: string): Promise<AltaPayScheduleRow> {
  const existing = await findOwnedSchedule(user, scheduleId);
  if (existing.status === "EXECUTED" || existing.status === "CANCELLED") {
    badRequest("This schedule cannot be cancelled.");
  }
  const row = await prisma.scheduledPayment.update({
    where: { id: scheduleId },
    data: { status: "CANCELLED" },
    include: { bankAccount: true },
  });
  const { recordPaymentScheduleCancelledAudit } = await import("@/server/payments-engine-audit.service");
  await recordPaymentScheduleCancelledAudit(user.id, row);
  return mapAltaPayScheduleRow(row);
}

async function findOwnedSchedule(user: AltaUser, scheduleId: string) {
  const existing = await prisma.scheduledPayment.findFirst({
    where: {
      id: scheduleId,
      createdByUserId: user.id,
      paymentChannel: "ALTA_PAY",
    },
  });
  if (!existing) notFound();
  return existing;
}
