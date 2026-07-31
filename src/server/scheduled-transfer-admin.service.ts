import type { ScheduledPaymentStatus, ScheduledTransferExecutionStatus } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { formatAltaUserHandle } from "@/lib/auth/user-display";
import type { InternalScheduledTransferRow } from "@/lib/bank/scheduled-transfer-admin-types";
import {
  executeDueScheduledTransfers,
  executeScheduledTransferNow,
  mapExecutionStatusLabel,
  resolveScheduledRunAt,
} from "@/server/scheduled-transfer-executor.service";
import { prisma } from "@/server/db";

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

const STATUS_FROM_DB: Record<ScheduledPaymentStatus, InternalScheduledTransferRow["status"]> = {
  PENDING_REVIEW: "pending_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXECUTED: "executed",
  CANCELLED: "cancelled",
  PAUSED: "paused",
  FAILED: "failed",
};

const STATUS_LABELS: Record<InternalScheduledTransferRow["status"], string> = {
  pending_review: "Pending review",
  approved: "Active",
  rejected: "Rejected",
  executed: "Completed",
  cancelled: "Cancelled",
  paused: "Paused",
  failed: "Failed",
};

const EXECUTION_FROM_DB: Record<
  ScheduledTransferExecutionStatus,
  InternalScheduledTransferRow["lastExecutionStatus"]
> = {
  PENDING: "pending",
  EXECUTED: "executed",
  FAILED: "failed",
  SKIPPED: "skipped",
};

function mapAdminRow(
  row: Awaited<ReturnType<typeof fetchScheduledPaymentRows>>[number],
): InternalScheduledTransferRow {
  const status = STATUS_FROM_DB[row.status];
  const lastExecutionStatus = row.lastExecutionStatus
    ? EXECUTION_FROM_DB[row.lastExecutionStatus]
    : null;

  return {
    id: row.id,
    label: row.label,
    amount: decimalToNumber(row.amount),
    currency: row.currency,
    status,
    statusLabel: STATUS_LABELS[status],
    paymentType: row.paymentType,
    transferScope: row.transferScope,
    sourceAccountId: row.bankAccount?.id ?? "",
    sourceAccountName: row.bankAccount?.accountName ?? "—",
    sourceAccountNumber: row.bankAccount?.accountNumber ?? "—",
    destinationAccountNumber: row.recipientAccountNumber,
    destinationName: row.recipientName,
    ownerLabel:
      row.company?.name ??
      formatAltaUserHandle({
        minecraftUsername: row.createdBy.minecraftUsername,
        discordUsername: row.createdBy.discordUsername,
      }),
    ownerType: row.companyId ? "company" : "personal",
    companyId: row.companyId,
    nextRunAt: resolveScheduledRunAt(row)?.toISOString() ?? null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    consecutiveFailures: row.consecutiveFailures,
    lastFailureReason: row.lastFailureReason,
    lastExecutionStatus,
    lastExecutionStatusLabel: mapExecutionStatusLabel(row.lastExecutionStatus),
    createdAt: row.createdAt.toISOString(),
  };
}

async function fetchScheduledPaymentRows() {
  return prisma.scheduledPayment.findMany({
    where: { transferScope: "INTRABANK" },
    include: {
      bankAccount: { select: { id: true, accountName: true, accountNumber: true, status: true } },
      createdBy: { select: { discordUsername: true, minecraftUsername: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { nextRunDate: "asc" }, { scheduledDate: "asc" }],
  });
}

export async function listInternalScheduledTransfers(): Promise<InternalScheduledTransferRow[]> {
  const rows = await fetchScheduledPaymentRows();
  return rows.map(mapAdminRow);
}

export async function listActiveInternalScheduledTransfers(): Promise<InternalScheduledTransferRow[]> {
  const rows = await fetchScheduledPaymentRows();
  return rows
    .filter((r) => ["APPROVED", "PAUSED", "PENDING_REVIEW"].includes(r.status))
    .map(mapAdminRow);
}

export type InternalScheduledTransferExecutionRow = {
  id: string;
  scheduledRunAt: string;
  status: string;
  statusLabel: string;
  transferReferenceCode: string | null;
  bankTransactionId: string | null;
  failureReason: string | null;
  executedAt: string | null;
};

export type InternalScheduledTransferDetail = InternalScheduledTransferRow & {
  frequency: string;
  frequencyLabel: string;
  memo: string | null;
  destinationAccountId: string | null;
  ownerUserId: string | null;
  executions: InternalScheduledTransferExecutionRow[];
};

const FREQUENCY_LABELS: Record<string, string> = {
  ONCE: "Once",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

export async function getInternalScheduledTransfer(
  paymentId: string,
): Promise<InternalScheduledTransferDetail> {
  const payment = await prisma.scheduledPayment.findFirst({
    where: { id: paymentId, transferScope: "INTRABANK" },
    include: {
      bankAccount: { select: { id: true, accountName: true, accountNumber: true, status: true } },
      createdBy: { select: { id: true, discordUsername: true, minecraftUsername: true } },
      company: { select: { id: true, name: true } },
      executions: {
        orderBy: { scheduledRunAt: "desc" },
        take: 20,
        select: {
          id: true,
          scheduledRunAt: true,
          status: true,
          transferReferenceCode: true,
          bankTransactionId: true,
          failureReason: true,
          executedAt: true,
        },
      },
    },
  });
  if (!payment) notFound();

  const base = mapAdminRow(
    payment as Awaited<ReturnType<typeof fetchScheduledPaymentRows>>[number],
  );
  const frequency = String(payment.frequency ?? "ONCE");
  return {
    ...base,
    frequency: frequency.toLowerCase(),
    frequencyLabel: FREQUENCY_LABELS[frequency] ?? frequency.replace(/_/g, " "),
    memo: payment.memo ?? null,
    destinationAccountId: null,
    ownerUserId: payment.companyId ? null : payment.createdBy.id,
    executions: payment.executions.map((e) => ({
      id: e.id,
      scheduledRunAt: e.scheduledRunAt.toISOString(),
      status: EXECUTION_FROM_DB[e.status] ?? String(e.status).toLowerCase(),
      statusLabel: mapExecutionStatusLabel(e.status) ?? String(e.status),
      transferReferenceCode: e.transferReferenceCode,
      bankTransactionId: e.bankTransactionId,
      failureReason: e.failureReason,
      executedAt: e.executedAt?.toISOString() ?? null,
    })),
  };
}

async function requireIntrabankPayment(paymentId: string) {
  const payment = await prisma.scheduledPayment.findFirst({
    where: { id: paymentId, transferScope: "INTRABANK" },
  });
  if (!payment) notFound();
  return payment;
}

export async function pauseInternalScheduledTransfer(_user: AltaUser, paymentId: string) {
  const payment = await requireIntrabankPayment(paymentId);
  if (payment.status === "EXECUTED" || payment.status === "CANCELLED") {
    badRequest("This transfer cannot be paused.");
  }
  await prisma.scheduledPayment.update({
    where: { id: paymentId },
    data: { status: "PAUSED" },
  });
}

export async function resumeInternalScheduledTransfer(_user: AltaUser, paymentId: string) {
  const payment = await requireIntrabankPayment(paymentId);
  if (payment.status !== "PAUSED") {
    badRequest("Only paused transfers can be resumed.");
  }
  await prisma.scheduledPayment.update({
    where: { id: paymentId },
    data: { status: "APPROVED", consecutiveFailures: 0, lastFailureReason: null },
  });
}

export async function cancelInternalScheduledTransfer(_user: AltaUser, paymentId: string) {
  const payment = await requireIntrabankPayment(paymentId);
  if (payment.status === "EXECUTED" || payment.status === "CANCELLED") {
    badRequest("This transfer cannot be cancelled.");
  }
  await prisma.scheduledPayment.update({
    where: { id: paymentId },
    data: { status: "CANCELLED" },
  });
}

export async function runInternalScheduledTransferNow(_user: AltaUser, paymentId: string) {
  return executeScheduledTransferNow(paymentId);
}

export async function runDueInternalScheduledTransfers(_user: AltaUser) {
  const [scheduledTransfers, payroll] = await Promise.all([
    executeDueScheduledTransfers(),
    (await import("@/server/payroll-executor.service")).executeDuePayrollRuns(),
  ]);
  return { scheduledTransfers, payroll };
}
