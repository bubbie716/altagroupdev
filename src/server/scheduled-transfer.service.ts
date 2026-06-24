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
  if (!input.label.trim() || !input.recipientName.trim()) {
    badRequest("Label and recipient name are required.");
  }

  if (input.transferScope === "interbank") {
    if (!input.recipientInstitution?.trim()) {
      badRequest("Recipient institution is required for interbank transfers.");
    }
    if (!input.routingNumber?.trim()) badRequest("Routing number is required for interbank transfers.");
    if (!input.wireAccountNumber?.trim()) {
      badRequest("Wire account number is required for interbank transfers.");
    }
  }

  const scheduledDate = input.scheduledDate ? new Date(input.scheduledDate) : null;
  if (input.paymentType === "one_time" || input.paymentType === "scheduled") {
    if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
      badRequest("Scheduled date is required.");
    }
  }

  if (input.paymentType === "recurring" && !input.frequency) {
    badRequest("Frequency is required for recurring transfers.");
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
      label: input.label.trim(),
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
  return mapScheduledPayment(row);
}
