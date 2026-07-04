import type { AltaUser } from "@/lib/auth/types";
import type {
  CreateUserScheduledTransferInput,
  ScheduledPaymentRow,
  ScheduledTransferScopeCode,
} from "@/lib/bank/business-banking-types";
import { listPaySourceAccounts } from "@/server/alta-pay.service";
import {
  mapScheduledPayment,
  toDbPaymentFrequency,
  toDbPaymentType,
  toDbTransferScope,
} from "@/server/business-banking-mapper";
import { isValidAltaAccountNumber } from "@/lib/bank/account-number";
import { resolveScheduledInputDateTime } from "@/lib/scheduled-datetime";
import { prisma } from "@/server/db";

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function initialScheduledPaymentStatus(transferScope: ScheduledTransferScopeCode): "PENDING_REVIEW" | "APPROVED" {
  return transferScope === "intrabank" ? "APPROVED" : "PENDING_REVIEW";
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

async function assertTransferSourceAccount(user: AltaUser, bankAccountId: string) {
  const allowedIds = new Set((await listPaySourceAccounts(user)).map((a) => a.id));
  if (!allowedIds.has(bankAccountId)) {
    badRequest("Select a valid source account.");
  }
}

function validateScheduledTransferInput(input: CreateUserScheduledTransferInput) {
  if (input.amount <= 0) badRequest("Amount must be greater than zero.");
  if (!input.recipientName.trim()) {
    badRequest("Recipient name is required.");
  }

  if (input.transferScope === "interbank") {
    badRequest(
      "Interbank wire transfers are not yet available. NCC settlement infrastructure is still being built.",
    );
  }

  if (input.transferScope === "intrabank") {
    const recipientAccountNumber = input.recipientAccountNumber?.trim();
    if (!recipientAccountNumber) {
      badRequest("Recipient Alta account number is required.");
    }
    if (!isValidAltaAccountNumber(recipientAccountNumber)) {
      badRequest("Enter a valid Alta Bank account number (AB-####-######).");
    }
  }

  const scheduledDate = resolveScheduledInputDateTime(input.scheduledDate, input.scheduledTime);
  if (input.paymentType === "one_time" || input.paymentType === "scheduled") {
    if (!scheduledDate) {
      badRequest("Scheduled date and time are required.");
    }
  }

  if (input.paymentType === "recurring" && !input.frequency) {
    badRequest("Frequency is required for recurring transfers.");
  }

  if (input.paymentType === "recurring" && !scheduledDate) {
    badRequest("First run date and time are required.");
  }

  return scheduledDate;
}

export async function listUserScheduledTransfers(
  user: AltaUser,
  scope: ScheduledTransferScopeCode,
): Promise<ScheduledPaymentRow[]> {
  const rows = await prisma.scheduledPayment.findMany({
    where: {
      companyId: null,
      createdByUserId: user.id,
      transferScope: toDbTransferScope(scope),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapScheduledPayment);
}

export async function createUserScheduledTransfer(
  user: AltaUser,
  input: CreateUserScheduledTransferInput,
): Promise<ScheduledPaymentRow> {
  await assertTransferSourceAccount(user, input.bankAccountId);
  const scheduledDate = validateScheduledTransferInput(input);

  const row = await prisma.scheduledPayment.create({
    data: {
      companyId: null,
      bankAccountId: input.bankAccountId,
      createdByUserId: user.id,
      transferScope: toDbTransferScope(input.transferScope),
      paymentType: toDbPaymentType(input.paymentType),
      label: input.recipientName.trim(),
      recipientName: input.recipientName.trim(),
      recipientAccountNumber:
        input.transferScope === "intrabank" ? input.recipientAccountNumber?.trim() || null : null,
      recipientInstitution:
        input.transferScope === "interbank" ? input.recipientInstitution?.trim() || null : null,
      routingNumber: input.transferScope === "interbank" ? input.routingNumber?.trim() || null : null,
      wireAccountNumber:
        input.transferScope === "interbank" ? input.wireAccountNumber?.trim() || null : null,
      amount: input.amount,
      frequency: input.frequency ? toDbPaymentFrequency(input.frequency) : null,
      scheduledDate,
      nextRunDate: input.paymentType === "recurring" ? scheduledDate : null,
      memo: input.memo?.trim() || null,
      status: initialScheduledPaymentStatus(input.transferScope),
    },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  const { auditSourceMetadata } = await import("@/lib/internal/audit-metadata");
  await writeAuditLog({
    actorUserId: user.id,
    action: "BANK_SCHEDULED_TRANSFER_CREATED",
    entityType: "SCHEDULED_PAYMENT",
    entityId: row.id,
    targetAccountId: input.bankAccountId,
    description: `Scheduled transfer "${input.recipientName.trim()}"`,
    metadata: auditSourceMetadata("website", {
      amount: input.amount,
      transferScope: input.transferScope,
      paymentType: input.paymentType,
    }),
  });

  return mapScheduledPayment(row);
}

export async function cancelUserScheduledTransfer(
  user: AltaUser,
  paymentId: string,
  scope: ScheduledTransferScopeCode,
): Promise<ScheduledPaymentRow> {
  const existing = await prisma.scheduledPayment.findFirst({
    where: {
      id: paymentId,
      companyId: null,
      createdByUserId: user.id,
      transferScope: toDbTransferScope(scope),
    },
  });
  if (!existing) notFound();
  if (existing.status === "EXECUTED" || existing.status === "CANCELLED" || existing.status === "FAILED") {
    badRequest("This transfer cannot be cancelled.");
  }

  const row = await prisma.scheduledPayment.update({
    where: { id: paymentId },
    data: { status: "CANCELLED" },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  const { auditSourceMetadata } = await import("@/lib/internal/audit-metadata");
  await writeAuditLog({
    actorUserId: user.id,
    action: "BANK_SCHEDULED_TRANSFER_CANCELLED",
    entityType: "SCHEDULED_PAYMENT",
    entityId: paymentId,
    targetAccountId: existing.bankAccountId,
    description: `Cancelled scheduled transfer "${existing.label}"`,
    metadata: auditSourceMetadata("website", {
      amount: Number(existing.amount.toString()),
      transferScope: scope,
    }),
  });

  return mapScheduledPayment(row);
}
