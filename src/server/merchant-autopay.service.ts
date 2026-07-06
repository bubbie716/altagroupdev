import type { AltaUser } from "@/lib/auth/types";
import type {
  AutopayEvaluationResult,
  CreateMerchantAutopayApprovalInput,
  MerchantAutopayApprovalRow,
  UpdateMerchantAutopayApprovalInput,
} from "@/lib/bank/payments-engine-types";
import {
  assertPaymentEngineFundingSource,
  parsePaymentEngineFundingSource,
  paymentEngineFundingLabel,
  paymentEngineFundingSourceKey,
} from "@/server/payment-engine-funding.service";
import {
  FREQUENCY_LABELS,
  paymentFrequencyFromDb,
  toDbPaymentFrequency,
} from "@/server/business-banking-mapper";
import { getPaymentsEnginePlatformSettings } from "@/server/payments-engine-platform-settings.service";
import { prisma } from "@/server/db";
import type { MerchantAutopayApproval, MerchantInvoice, PaymentFrequency } from "@prisma/client";

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function mapApproval(
  row: MerchantAutopayApproval & {
    merchantCompany: { name: string };
    fundingAccount: { accountName: string; accountNumber: string } | null;
    fundingSource: unknown;
  },
): MerchantAutopayApprovalRow {
  const frequency = paymentFrequencyFromDb(row.allowedFrequency);
  const status = row.status === "ACTIVE" ? "active" : row.status === "PAUSED" ? "paused" : "cancelled";
  const fundingSource =
    parsePaymentEngineFundingSource(row.fundingSource, row.fundingAccountId) ??
    ({ kind: "bank_account", accountId: row.fundingAccountId ?? "" } as const);
  const fundingAccountLabel =
    fundingSource.kind === "bank_account" && row.fundingAccount
      ? `${row.fundingAccount.accountName} · ${row.fundingAccount.accountNumber.slice(-4).padStart(8, "••••")}`
      : paymentEngineFundingLabel(fundingSource);
  return {
    id: row.id,
    merchantCompanyId: row.merchantCompanyId,
    merchantName: row.merchantCompany.name,
    fundingSource,
    fundingAccountLabel,
    maxInvoiceAmount: decimalToNumber(row.maxInvoiceAmount),
    confirmationRequiredAboveAmount: row.confirmationRequiredAboveAmount
      ? decimalToNumber(row.confirmationRequiredAboveAmount)
      : null,
    allowedFrequency: frequency,
    allowedFrequencyLabel: FREQUENCY_LABELS[frequency],
    maxPaymentsPerMonth: row.maxPaymentsPerMonth,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    allowRecurringInvoices: row.allowRecurringInvoices,
    status,
    statusLabel: status === "active" ? "Active" : status === "paused" ? "Paused" : "Cancelled",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const approvalInclude = {
  merchantCompany: { select: { name: true } },
  fundingAccount: { select: { accountName: true, accountNumber: true } },
} as const;

export async function listMerchantAutopayApprovals(user: AltaUser): Promise<MerchantAutopayApprovalRow[]> {
  const rows = await prisma.merchantAutopayApproval.findMany({
    where: { userId: user.id, status: { not: "CANCELLED" } },
    include: approvalInclude,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapApproval);
}

export async function createMerchantAutopayApproval(
  user: AltaUser,
  input: CreateMerchantAutopayApprovalInput,
): Promise<MerchantAutopayApprovalRow> {
  await assertPaymentEngineFundingSource(user, input.fundingSource, {
    merchantCompanyId: input.merchantCompanyId,
  });
  const settings = await getPaymentsEnginePlatformSettings();
  const company = await prisma.company.findUnique({ where: { id: input.merchantCompanyId } });
  if (!company || company.verificationStatus !== "VERIFIED") {
    badRequest("Merchant must be a verified company.");
  }

  const maxInvoiceAmount = input.maxInvoiceAmount > 0 ? input.maxInvoiceAmount : settings.defaultAutopayMaxInvoiceAmount;
  const expiresAt = input.expiresAt
    ? new Date(input.expiresAt)
    : new Date(Date.now() + settings.defaultMerchantApprovalExpiryDays * 86_400_000);

  const fundingSourceKey = paymentEngineFundingSourceKey(input.fundingSource);

  const row = await prisma.merchantAutopayApproval.upsert({
    where: {
      userId_merchantCompanyId_fundingSourceKey: {
        userId: user.id,
        merchantCompanyId: input.merchantCompanyId,
        fundingSourceKey,
      },
    },
    create: {
      userId: user.id,
      merchantCompanyId: input.merchantCompanyId,
      fundingAccountId:
        input.fundingSource.kind === "bank_account" ? input.fundingSource.accountId : null,
      fundingSource: input.fundingSource,
      fundingSourceKey,
      maxInvoiceAmount,
      confirmationRequiredAboveAmount: input.confirmationRequiredAboveAmount ?? null,
      allowedFrequency: toDbPaymentFrequency(input.allowedFrequency),
      maxPaymentsPerMonth: input.maxPaymentsPerMonth ?? 1,
      expiresAt,
      allowRecurringInvoices: input.allowRecurringInvoices ?? true,
      status: "ACTIVE",
    },
    update: {
      fundingAccountId:
        input.fundingSource.kind === "bank_account" ? input.fundingSource.accountId : null,
      fundingSource: input.fundingSource,
      maxInvoiceAmount,
      confirmationRequiredAboveAmount: input.confirmationRequiredAboveAmount ?? null,
      allowedFrequency: toDbPaymentFrequency(input.allowedFrequency),
      maxPaymentsPerMonth: input.maxPaymentsPerMonth ?? 1,
      expiresAt,
      allowRecurringInvoices: input.allowRecurringInvoices ?? true,
      status: "ACTIVE",
    },
    include: approvalInclude,
  });

  const { recordMerchantAutopayApprovalCreatedAudit } = await import("@/server/payments-engine-audit.service");
  const { notifyMerchantAutopayApprovalCreatedBestEffort } = await import(
    "@/server/payments-engine-notification.service"
  );
  await recordMerchantAutopayApprovalCreatedAudit(user.id, row.id, company.name);
  void notifyMerchantAutopayApprovalCreatedBestEffort(user.id, company.name);

  return mapApproval(row);
}

export async function updateMerchantAutopayApproval(
  user: AltaUser,
  input: UpdateMerchantAutopayApprovalInput,
): Promise<MerchantAutopayApprovalRow> {
  const existing = await prisma.merchantAutopayApproval.findFirst({
    where: { id: input.approvalId, userId: user.id, status: { not: "CANCELLED" } },
    include: approvalInclude,
  });
  if (!existing) notFound();

  const row = await prisma.merchantAutopayApproval.update({
    where: { id: input.approvalId },
    data: {
      ...(input.maxInvoiceAmount != null ? { maxInvoiceAmount: input.maxInvoiceAmount } : {}),
      ...(input.confirmationRequiredAboveAmount !== undefined
        ? { confirmationRequiredAboveAmount: input.confirmationRequiredAboveAmount }
        : {}),
      ...(input.allowedFrequency ? { allowedFrequency: toDbPaymentFrequency(input.allowedFrequency) } : {}),
      ...(input.maxPaymentsPerMonth != null ? { maxPaymentsPerMonth: input.maxPaymentsPerMonth } : {}),
      ...(input.expiresAt !== undefined
        ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
        : {}),
      ...(input.allowRecurringInvoices != null ? { allowRecurringInvoices: input.allowRecurringInvoices } : {}),
    },
    include: approvalInclude,
  });

  const { recordMerchantAutopayApprovalUpdatedAudit } = await import("@/server/payments-engine-audit.service");
  const { notifyMerchantAutopayApprovalUpdatedBestEffort } = await import(
    "@/server/payments-engine-notification.service"
  );
  await recordMerchantAutopayApprovalUpdatedAudit(user.id, row.id, row.merchantCompany.name);
  void notifyMerchantAutopayApprovalUpdatedBestEffort(user.id, row.merchantCompany.name);
  return mapApproval(row);
}

export async function pauseMerchantAutopayApproval(user: AltaUser, approvalId: string): Promise<MerchantAutopayApprovalRow> {
  const existing = await findOwnedApproval(user, approvalId);
  if (existing.status !== "ACTIVE") badRequest("Only active approvals can be paused.");
  const row = await prisma.merchantAutopayApproval.update({
    where: { id: approvalId },
    data: { status: "PAUSED" },
    include: approvalInclude,
  });
  const { recordMerchantAutopayApprovalPausedAudit } = await import("@/server/payments-engine-audit.service");
  const { notifyMerchantAutopayApprovalPausedBestEffort } = await import(
    "@/server/payments-engine-notification.service"
  );
  await recordMerchantAutopayApprovalPausedAudit(user.id, row.id, row.merchantCompany.name);
  void notifyMerchantAutopayApprovalPausedBestEffort(user.id, row.merchantCompany.name);
  return mapApproval(row);
}

export async function cancelMerchantAutopayApproval(user: AltaUser, approvalId: string): Promise<MerchantAutopayApprovalRow> {
  await findOwnedApproval(user, approvalId);
  const row = await prisma.merchantAutopayApproval.update({
    where: { id: approvalId },
    data: { status: "CANCELLED" },
    include: approvalInclude,
  });
  const { recordMerchantAutopayApprovalCancelledAudit } = await import("@/server/payments-engine-audit.service");
  const { notifyMerchantAutopayApprovalCancelledBestEffort } = await import(
    "@/server/payments-engine-notification.service"
  );
  await recordMerchantAutopayApprovalCancelledAudit(user.id, row.id, row.merchantCompany.name);
  void notifyMerchantAutopayApprovalCancelledBestEffort(user.id, row.merchantCompany.name);
  return mapApproval(row);
}

async function findOwnedApproval(user: AltaUser, approvalId: string) {
  const existing = await prisma.merchantAutopayApproval.findFirst({
    where: { id: approvalId, userId: user.id },
    include: approvalInclude,
  });
  if (!existing) notFound();
  return existing;
}

export async function evaluateMerchantAutopayForInvoice(
  invoice: MerchantInvoice & { merchantCompany: { name: string } },
): Promise<AutopayEvaluationResult> {
  if (!invoice.recipientUserId) return { allowed: false, reason: "Invoice recipient is not a user account." };
  if (invoice.status !== "SENT" && invoice.status !== "OVERDUE") {
    return { allowed: false, reason: "Invoice is not payable." };
  }

  const amount = decimalToNumber(invoice.amount);
  const approvals = await prisma.merchantAutopayApproval.findMany({
    where: {
      userId: invoice.recipientUserId,
      merchantCompanyId: invoice.merchantCompanyId,
      status: "ACTIVE",
    },
  });

  if (approvals.length === 0) return { allowed: false, reason: "Merchant not approved for AutoPay." };

  const now = new Date();
  let monthlyLimitReached = false;
  for (const approval of approvals) {
    if (approval.expiresAt && approval.expiresAt < now) continue;
    if (amount > decimalToNumber(approval.maxInvoiceAmount)) continue;
    if (invoice.isRecurring && !approval.allowRecurringInvoices) continue;

    const { countAutopayExecutionsThisMonth } = await import("@/server/payments-engine-audit.service");
    const used = await countAutopayExecutionsThisMonth(approval.id, invoice.recipientUserId, invoice.merchantCompanyId);
    if (used >= approval.maxPaymentsPerMonth) {
      monthlyLimitReached = true;
      continue;
    }

    const confirmAbove = approval.confirmationRequiredAboveAmount
      ? decimalToNumber(approval.confirmationRequiredAboveAmount)
      : null;
    if (confirmAbove != null && amount > confirmAbove) {
      const fundingSource = parsePaymentEngineFundingSource(
        approval.fundingSource,
        approval.fundingAccountId,
      );
      if (!fundingSource) continue;
      return {
        allowed: false,
        requiresConfirmation: true,
        reason: "Amount exceeds confirmation threshold.",
        approvalId: approval.id,
        fundingSource,
        fundingAccountId:
          fundingSource.kind === "bank_account" ? fundingSource.accountId : undefined,
      };
    }

    const fundingSource = parsePaymentEngineFundingSource(
      approval.fundingSource,
      approval.fundingAccountId,
    );
    if (!fundingSource) continue;

    return {
      allowed: true,
      approvalId: approval.id,
      fundingSource,
      fundingAccountId:
        fundingSource.kind === "bank_account" ? fundingSource.accountId : undefined,
    };
  }

  if (monthlyLimitReached) {
    const limit = approvals[0]?.maxPaymentsPerMonth ?? 1;
    return {
      allowed: false,
      reason: `Monthly AutoPay limit reached (${limit} payment${limit === 1 ? "" : "s"} per merchant).`,
    };
  }

  return { allowed: false, reason: "No active AutoPay approval matched invoice rules." };
}

export async function attemptMerchantInvoiceAutopay(invoiceId: string): Promise<{ paid: boolean; reason?: string }> {
  const invoice = await prisma.merchantInvoice.findUnique({
    where: { id: invoiceId },
    include: { merchantCompany: { select: { name: true } } },
  });
  if (!invoice || !invoice.recipientUserId) return { paid: false, reason: "Invoice not found." };

  const evaluation = await evaluateMerchantAutopayForInvoice(invoice);
  if (evaluation.requiresConfirmation) {
    const amount = decimalToNumber(invoice.amount);
    const { buildAutopayConfirmationDmPayload } = await import(
      "@/server/merchant-invoice-notification.service"
    );
    const { notifyMerchantAutopayConfirmationRequiredBestEffort } = await import(
      "@/server/payments-engine-notification.service"
    );
    const customDmPayload = await buildAutopayConfirmationDmPayload(invoice.id);
    await notifyMerchantAutopayConfirmationRequiredBestEffort({
      userId: invoice.recipientUserId,
      invoiceId: invoice.id,
      merchantName: invoice.merchantCompany.name,
      amount,
      referenceCode: invoice.referenceCode,
      customDmPayload: customDmPayload ?? undefined,
    });
    return { paid: false, reason: evaluation.reason ?? "Confirmation required." };
  }

  if (!evaluation.allowed || !evaluation.approvalId || !evaluation.fundingSource) {
    return { paid: false, reason: evaluation.reason };
  }

  const user = await (await import("@/server/bank-account-access.service")).loadAltaUserOrThrow(invoice.recipientUserId);
  const idempotencyKey = `autopay:${invoice.id}:${evaluation.approvalId}`;

  try {
    const { payMerchantInvoice } = await import("@/server/merchant-invoice-payment.service");
    const result = await payMerchantInvoice(
      user,
      {
        invoiceId: invoice.id,
        fundingSource: evaluation.fundingSource,
        idempotencyKey,
      },
      { source: "autopay" },
    );

    await prisma.merchantInvoicePayment.updateMany({
      where: { invoiceId: invoice.id, idempotencyKey },
      data: { isAutopay: true, autopayApprovalId: evaluation.approvalId },
    });

    const { recordMerchantAutopayExecutedAudit } = await import("@/server/payments-engine-audit.service");
    const { notifyMerchantInvoiceAutopaidBestEffort } = await import(
      "@/server/payments-engine-notification.service"
    );
    await recordMerchantAutopayExecutedAudit(user.id, evaluation.approvalId, invoice.id, result.paymentReferenceCode);
    await notifyMerchantInvoiceAutopaidBestEffort(
      user.id,
      invoice.merchantCompany.name,
      result.amount,
      invoice.referenceCode,
      undefined,
      invoice.id,
    );

    return { paid: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message.replace(/^BAD_REQUEST:/, "") : "AutoPay failed.";
    const { recordMerchantAutopayFailedAudit } = await import("@/server/payments-engine-audit.service");
    const { notifyMerchantAutopayFailedBestEffort } = await import(
      "@/server/payments-engine-notification.service"
    );
    await recordMerchantAutopayFailedAudit(user.id, evaluation.approvalId, invoice.id, reason);
    await notifyMerchantAutopayFailedBestEffort(user.id, invoice.merchantCompany.name, reason);
    return { paid: false, reason };
  }
}

export async function tryAutopayAfterInvoiceSent(invoiceId: string): Promise<void> {
  await attemptMerchantInvoiceAutopay(invoiceId);
}
