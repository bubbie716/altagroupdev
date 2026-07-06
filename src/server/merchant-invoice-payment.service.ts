import { randomBytes } from "node:crypto";
import type { AltaUser } from "@/lib/auth/types";
import { canPayReceivedMerchantInvoice } from "@/lib/auth/permissions";
import {
  MERCHANT_INVOICE_PAY_REFERENCE_PREFIX,
  PAYABLE_INVOICE_STATUSES,
  type MerchantInvoiceFundingSource,
  type MerchantInvoicePaymentQuote,
  type PayMerchantInvoiceResult,
} from "@/lib/bank/merchant-invoice-types";
import type { BankingStaffAuditContext } from "@/lib/staff-audit/staff-audit-types";
import { formatFlorin } from "@/lib/bank/format";
import { prisma } from "@/server/db";
import {
  settleCommercialPaymentFromAltaCardInTx,
  settleToCompanyOperatingAccountInTx,
} from "@/server/alta-pay-settlement.service";
import {
  appendMerchantInvoiceEvent,
  recordMerchantInvoicePaidAudit,
  writeMerchantInvoiceAudit,
} from "@/server/merchant-invoice-audit.service";
import { quoteMerchantInvoiceFees } from "@/server/merchant-invoice-fee.service";
import { listPayFundingSources, resolvePayFundingSourceOption, resolvePaySourceAccount } from "@/server/alta-pay.service";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function conflict(message: string): never {
  throw new Error(`CONFLICT:${message}`);
}

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function generatePaymentReferenceBase(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${MERCHANT_INVOICE_PAY_REFERENCE_PREFIX}${date}-${suffix}`;
}

async function loadPayableInvoice(invoiceId: string) {
  const invoice = await prisma.merchantInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      merchantCompany: {
        include: {
          bankAccounts: {
            where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
            take: 1,
          },
        },
      },
      destinationAccount: true,
    },
  });
  if (!invoice) notFound();
  return invoice;
}

function assertInvoicePayable(invoice: {
  status: string;
  recipientUserId: string | null;
  recipientCompanyId: string | null;
  amount: { toString(): string };
  amountPaid: { toString(): string };
  merchantCompany: { verificationStatus: string };
  destinationAccount: { status: string; restrictDeposits: boolean };
}): number {
  if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status as (typeof PAYABLE_INVOICE_STATUSES)[number])) {
    if (invoice.status === "PAID") conflict("This invoice has already been paid.");
    if (invoice.status === "CANCELLED" || invoice.status === "VOIDED") {
      badRequest("This invoice is no longer payable.");
    }
    badRequest("This invoice is not payable.");
  }
  if (invoice.merchantCompany.verificationStatus !== "VERIFIED") {
    badRequest("This merchant is not available to receive payments.");
  }
  if (invoice.destinationAccount.status !== "ACTIVE" || invoice.destinationAccount.restrictDeposits) {
    badRequest("The merchant account cannot receive deposits right now.");
  }
  const amountDue =
    Math.round((decimalToNumber(invoice.amount) - decimalToNumber(invoice.amountPaid)) * 100) / 100;
  if (amountDue <= 0) conflict("This invoice has already been paid.");
  return amountDue;
}

export async function quoteMerchantInvoicePayment(
  user: AltaUser,
  invoiceId: string,
): Promise<MerchantInvoicePaymentQuote> {
  const invoice = await loadPayableInvoice(invoiceId);
  if (!canPayReceivedMerchantInvoice(user, invoice)) forbidden();
  const amountDue = assertInvoicePayable(invoice);
  const fees = await quoteMerchantInvoiceFees(amountDue, invoice.merchantCompanyId);

  return {
    invoiceId: invoice.id,
    referenceCode: invoice.referenceCode,
    merchantName: invoice.merchantCompany.name,
    amount: amountDue,
    feeAmount: fees.feeAmount,
    totalDebited: fees.totalDebited,
    netToMerchant: fees.netAmount,
    description: invoice.description,
    dueDate: invoice.dueDate?.toISOString() ?? null,
    status: invoice.status,
  };
}

export async function payMerchantInvoice(
  user: AltaUser,
  input: {
    invoiceId: string;
    fundingSource: MerchantInvoiceFundingSource;
    idempotencyKey: string;
  },
  auditContext?: BankingStaffAuditContext,
): Promise<PayMerchantInvoiceResult> {
  if (!input.idempotencyKey.trim()) badRequest("Idempotency key is required.");

  const existingAttempt = await prisma.merchantInvoicePayment.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: {
      invoice: {
        include: {
          merchantCompany: true,
          payment: true,
        },
      },
    },
  });
  if (existingAttempt?.status === "COMPLETED" && existingAttempt.invoice.payment) {
    const sources = await listPayFundingSources(user);
    const source = resolvePayFundingSourceOption(sources, input.fundingSource);
    return {
      invoiceId: existingAttempt.invoiceId,
      referenceCode: existingAttempt.invoice.referenceCode,
      paymentReferenceCode: existingAttempt.invoice.payment.referenceCode,
      amount: decimalToNumber(existingAttempt.amount),
      feeAmount: decimalToNumber(existingAttempt.feeAmount),
      totalDebited: decimalToNumber(existingAttempt.amount),
      merchantName: existingAttempt.invoice.merchantCompany.name,
      fundingSourceLabel: source?.label ?? "Alta Bank account",
    };
  }

  const invoice = await loadPayableInvoice(input.invoiceId);
  if (!canPayReceivedMerchantInvoice(user, invoice)) forbidden();

  const allowedFunding = await listPayFundingSources(user);
  const selectedFunding = resolvePayFundingSourceOption(allowedFunding, input.fundingSource);

  const source = auditContext?.source ?? "website";
  const fees = await quoteMerchantInvoiceFees(
    decimalToNumber(invoice.amount),
    invoice.merchantCompanyId,
  );
  const referenceBase = generatePaymentReferenceBase();
  const payerLabel = user.minecraftUsername?.trim() || user.discordUsername;
  const memo = `Invoice ${invoice.referenceCode}`;

  let fundingSourceLabel = selectedFunding.label;
  let paymentReferenceCode = referenceBase;
  let paymentId = "";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.merchantInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          merchantCompany: true,
          destinationAccount: true,
        },
      });
      if (!locked) notFound();
      assertInvoicePayable(locked);

      const duplicateCompleted = await tx.merchantInvoicePayment.findFirst({
        where: { invoiceId: locked.id, status: "COMPLETED" },
      });
      if (duplicateCompleted) conflict("This invoice has already been paid.");

      const attempt =
        existingAttempt ??
        (await tx.merchantInvoicePayment.create({
          data: {
            invoiceId: locked.id,
            amount: fees.totalDebited,
            feeAmount: fees.feeAmount,
            idempotencyKey: input.idempotencyKey,
            initiatedByUserId: user.id,
            fundingSource: input.fundingSource,
            source,
            status: "PENDING",
          },
        }));

      if (attempt.status === "FAILED") {
        await tx.merchantInvoicePayment.update({
          where: { id: attempt.id },
          data: { status: "PENDING", failureReason: null },
        });
      }

      let settlement: Awaited<ReturnType<typeof settleToCompanyOperatingAccountInTx>>;
      let resolvedPayerLabel = payerLabel;

      if (input.fundingSource.kind === "bank_account") {
        const { account: sourceAccount, payerLabel: accountPayerLabel } =
          await resolvePaySourceAccount(user, input.fundingSource.accountId);
        resolvedPayerLabel = accountPayerLabel;

        if (
          locked.recipientCompanyId &&
          sourceAccount.companyId !== locked.recipientCompanyId
        ) {
          badRequest("Pay this invoice from the recipient company's operating account.");
        }

        if (sourceAccount.id === locked.destinationAccountId) {
          badRequest("Cannot pay an invoice from the merchant's own operating account.");
        }
        if (
          sourceAccount.companyId &&
          sourceAccount.companyId === locked.merchantCompanyId
        ) {
          badRequest("Cannot pay this invoice from the merchant company's operating account.");
        }

        fundingSourceLabel = sourceAccount.accountName;

        settlement = await settleToCompanyOperatingAccountInTx(tx, {
          paymentType: "MERCHANT_INVOICE",
          referenceBase,
          payerUserId: user.id,
          payerLabel: resolvedPayerLabel,
          companyId: locked.merchantCompanyId,
          companyName: locked.merchantCompany.name,
          sourceAccountId: sourceAccount.id,
          destinationAccountId: locked.destinationAccountId,
          grossAmount: fees.totalDebited,
          initiatedByUserId: user.id,
          memo,
          metadata: {
            merchantInvoiceId: locked.id,
            invoiceReference: locked.referenceCode,
            feeAmount: fees.feeAmount,
            netAmount: fees.netAmount,
          },
          outDescription: `Merchant invoice payment to ${locked.merchantCompany.name}`,
          inDescription: `Merchant invoice payment from ${payerLabel}`,
        });
      } else {
        if (selectedFunding.employerCompanyId === locked.merchantCompanyId) {
          badRequest("You cannot use this Alta Card to pay the company it belongs to.");
        }

        const cardSettlement = await settleCommercialPaymentFromAltaCardInTx(tx, {
          paymentType: "MERCHANT_INVOICE",
          referenceBase,
          user,
          cardId: input.fundingSource.cardId,
          payerLabel: user.discordUsername,
          companyId: locked.merchantCompanyId,
          companyName: locked.merchantCompany.name,
          destinationAccountId: locked.destinationAccountId,
          grossAmount: fees.totalDebited,
          initiatedByUserId: user.id,
          memo,
          metadata: {
            merchantInvoiceId: locked.id,
            invoiceReference: locked.referenceCode,
            feeAmount: fees.feeAmount,
            netAmount: fees.netAmount,
          },
          inDescription: `Merchant invoice payment from ${user.discordUsername}`,
        });
        settlement = cardSettlement;
        fundingSourceLabel = cardSettlement.fundingSourceLabel;
        resolvedPayerLabel = user.discordUsername;
      }

      paymentId = settlement.paymentId;
      paymentReferenceCode = settlement.referenceBase;

      const now = new Date();
      await tx.merchantInvoicePayment.update({
        where: { id: attempt.id },
        data: {
          status: "COMPLETED",
          paymentId: settlement.paymentId,
          transferGroupId: settlement.transferGroupId,
          completedAt: now,
        },
      });

      await tx.merchantInvoice.update({
        where: { id: locked.id },
        data: {
          status: "PAID",
          paidAt: now,
          amountPaid: locked.amount,
          feeAmount: fees.feeAmount,
          netAmount: fees.netAmount,
          paymentId: settlement.paymentId,
        },
      });

      return { locked, settlement, resolvedPayerLabel, paidAt: now };
    });

    await recordMerchantInvoicePaidAudit({
      actorUserId: user.id,
      invoiceId: result.locked.id,
      merchantCompanyId: result.locked.merchantCompanyId,
      merchantName: result.locked.merchantCompany.name,
      recipientUserId: result.locked.recipientUserId,
      recipientCompanyId: result.locked.recipientCompanyId,
      payerLabel: result.resolvedPayerLabel,
      amount: fees.totalDebited,
      referenceCode: result.locked.referenceCode,
      paymentReferenceCode,
      targetTransactionId: result.settlement.outTransactionId,
      source,
      paidAt: result.paidAt,
      feeAmount: fees.feeAmount,
      metadata: { idempotencyKey: input.idempotencyKey },
    });

    try {
      const { recordMerchantPaymentReceivedAudit } = await import(
        "@/server/commercial-audit.service"
      );
      await recordMerchantPaymentReceivedAudit({
        actorUserId: user.id,
        companyId: result.locked.merchantCompanyId,
        source: "invoice",
        referenceCode: paymentReferenceCode,
        amount: fees.totalDebited,
        customerLabel: result.resolvedPayerLabel,
        entityId: result.locked.id,
        auditSource: source,
      });
    } catch (auditError) {
      console.error("[merchant-invoice] commercial payment received audit failed", auditError);
    }

    void (async () => {
      try {
        const { notifyMerchantInvoicePaid } = await import(
          "@/server/merchant-invoice-notification.service"
        );
        await notifyMerchantInvoicePaid(result.locked.id, paymentId, {
          autopay: source === "autopay",
        });
      } catch (error) {
        console.error("[merchant-invoice] paid notification failed", error);
      }

      try {
        const { notifyMerchantFirstPaymentReceivedBestEffort } = await import(
          "@/server/commercial-notification.service"
        );
        await notifyMerchantFirstPaymentReceivedBestEffort({
          companyId: result.locked.merchantCompanyId,
          merchantName: result.locked.merchantCompany.name,
          amount: fees.totalDebited,
          source: "invoice",
        });
      } catch (error) {
        console.error("[merchant-invoice] first payment notification failed", error);
      }
    })();

    void (async () => {
      const { refreshUserRelationshipProfileBestEffort, refreshCompanyRelationshipStackBestEffort } =
        await import("@/server/relationship-refresh-hooks.service");
      try {
        await refreshUserRelationshipProfileBestEffort(user.id, "merchant-invoice-paid");
        await refreshCompanyRelationshipStackBestEffort(
          result.locked.merchantCompanyId,
          "merchant-invoice-paid",
        );
      } catch (error) {
        console.error("[merchant-invoice] relationship refresh failed", error);
      }
    })();

    return {
      invoiceId: result.locked.id,
      referenceCode: result.locked.referenceCode,
      paymentReferenceCode,
      amount: fees.totalDebited,
      feeAmount: fees.feeAmount,
      totalDebited: fees.totalDebited,
      merchantName: result.locked.merchantCompany.name,
      fundingSourceLabel,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment failed.";
    const { toCustomerSafePaymentFailureReason } = await import(
      "@/lib/bank/customer-payment-failure-reason"
    );
    const failureReason = toCustomerSafePaymentFailureReason(
      message.startsWith("BAD_REQUEST:")
        ? message.slice("BAD_REQUEST:".length)
        : message.startsWith("CONFLICT:")
          ? message.slice("CONFLICT:".length)
          : message,
    );

    await prisma.merchantInvoicePayment.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        invoiceId: input.invoiceId,
        amount: fees.totalDebited,
        feeAmount: fees.feeAmount,
        idempotencyKey: input.idempotencyKey,
        initiatedByUserId: user.id,
        fundingSource: input.fundingSource,
        source,
        status: "FAILED",
        failureReason,
      },
      update: {
        status: "FAILED",
        failureReason,
      },
    });

    await writeMerchantInvoiceAudit({
      actorUserId: user.id,
      action: "MERCHANT_INVOICE_PAYMENT_FAILED",
      invoiceId: invoice.id,
      merchantCompanyId: invoice.merchantCompanyId,
      recipientUserId: invoice.recipientUserId,
      recipientCompanyId: invoice.recipientCompanyId,
      amount: decimalToNumber(invoice.amount),
      status: invoice.status,
      referenceCode: invoice.referenceCode,
      source,
      metadata: { failureReason, idempotencyKey: input.idempotencyKey },
    });
    await appendMerchantInvoiceEvent({
      invoiceId: invoice.id,
      eventType: "PAYMENT_FAILED",
      actorUserId: user.id,
      source,
      metadata: { failureReason },
    });

    try {
      const {
        recordMerchantPaymentFailedAudit,
        notifyMerchantPaymentFailed,
        listMerchantFinanceUserIds,
      } = await import("@/server/commercial-audit.service");
      await recordMerchantPaymentFailedAudit({
        actorUserId: user.id,
        companyId: invoice.merchantCompanyId,
        source: "invoice",
        referenceCode: invoice.referenceCode,
        amount: decimalToNumber(invoice.amount),
        customerLabel: payerLabel,
        entityId: invoice.id,
        failureReason,
        auditSource: source,
      });
      const merchantUserIds = await listMerchantFinanceUserIds(invoice.merchantCompanyId);
      await notifyMerchantPaymentFailed({
        companyId: invoice.merchantCompanyId,
        merchantUserIds,
        title: "Invoice payment failed",
        body: `A payment attempt for invoice ${invoice.referenceCode} (${formatFlorin(decimalToNumber(invoice.amount))}) could not be completed. ${failureReason}`,
        linkUrl: `/bank/commercial/invoices/${invoice.id}?companyId=${invoice.merchantCompanyId}`,
        metadata: { invoiceId: invoice.id, failureReason },
      });

      const { notifyPayerPaymentFailedBestEffort } = await import("@/server/commercial-notification.service");
      await notifyPayerPaymentFailedBestEffort({
        payerUserId: user.id,
        merchantName: invoice.merchantCompany.name,
        amount: decimalToNumber(invoice.amount),
        referenceCode: invoice.referenceCode,
        reason: failureReason,
        tryAgainUrl: `/bank/pay/invoices/${invoice.id}`,
        source: "invoice",
      });
    } catch (notifyError) {
      console.error("[merchant-invoice] merchant payment failed notification error", notifyError);
    }

    try {
      const { alertMerchantInvoicePaymentFailed } = await import(
        "@/server/merchant-invoice-staff-audit.service"
      );
      await alertMerchantInvoicePaymentFailed(invoice.id, failureReason);
    } catch (staffError) {
      console.error("[merchant-invoice] staff payment failed alert error", staffError);
    }

    if (message.startsWith("BAD_REQUEST:")) badRequest(failureReason);
    if (message.startsWith("CONFLICT:")) conflict(failureReason);
    if (message === "FORBIDDEN") forbidden();
    if (message === "NOT_FOUND") notFound();
    throw error;
  }
}
