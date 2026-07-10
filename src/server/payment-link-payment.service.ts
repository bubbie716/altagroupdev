import { randomBytes } from "node:crypto";
import type { AltaUser } from "@/lib/auth/types";
import {
  PAYMENT_LINK_PAY_REFERENCE_PREFIX,
  type PayPaymentLinkInput,
  type PayPaymentLinkResult,
  type PaymentLinkFundingSource,
  type PaymentLinkPaymentQuote,
} from "@/lib/bank/payment-link-types";
import type { BankingStaffAuditContext } from "@/lib/staff-audit/staff-audit-types";
import { prisma } from "@/server/db";
import { listPayFundingSources, resolvePayFundingSourceOption, resolvePaySourceAccount } from "@/server/alta-pay.service";
import {
  settleCommercialPaymentFromAltaCardInTx,
  settleToCompanyOperatingAccountInTx,
} from "@/server/alta-pay-settlement.service";
import {
  appendPaymentLinkEvent,
  recordPaymentLinkPaidAudit,
  writePaymentLinkAudit,
} from "@/server/payment-link-audit.service";
import { quotePaymentLinkFees } from "@/server/payment-link-fee.service";
import { loadPaymentLinkForPayment } from "@/server/payment-link.service";

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
  return `${PAYMENT_LINK_PAY_REFERENCE_PREFIX}${date}-${suffix}`;
}

function resolvePayAmount(link: {
  amountType: string;
  amount: { toString(): string } | null;
  minAmount: { toString(): string } | null;
  maxAmount: { toString(): string } | null;
  status: string;
  usageType: string;
  merchantCompany: { verificationStatus: string };
  destinationAccount: { status: string; restrictDeposits: boolean };
  expiresAt: Date | null;
}, requestedAmount?: number): number {
  if (link.status !== "ACTIVE") {
    if (link.status === "COMPLETED") conflict("This payment link has already been used.");
    if (link.status === "EXPIRED") badRequest("This payment link has expired.");
    if (link.status === "PAUSED") badRequest("This payment link is paused.");
    if (link.status === "CANCELLED") badRequest("This payment link is no longer available.");
    badRequest("This payment link is not available.");
  }
  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
    badRequest("This payment link has expired.");
  }
  if (link.merchantCompany.verificationStatus !== "VERIFIED") {
    badRequest("This merchant is not available to receive payments.");
  }
  if (link.destinationAccount.status !== "ACTIVE" || link.destinationAccount.restrictDeposits) {
    badRequest("The merchant account cannot receive deposits right now.");
  }

  if (link.amountType === "FIXED") {
    const fixed = decimalToNumber(link.amount);
    if (fixed == null || fixed <= 0) badRequest("This payment link has an invalid amount.");
    return fixed;
  }

  if (requestedAmount == null || !Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    badRequest("Enter a valid payment amount.");
  }

  const min = link.minAmount ? decimalToNumber(link.minAmount) : null;
  const max = link.maxAmount ? decimalToNumber(link.maxAmount) : null;
  if (min != null && requestedAmount < min) {
    badRequest(`Amount must be at least ƒ${min.toLocaleString()}.`);
  }
  if (max != null && requestedAmount > max) {
    badRequest(`Amount cannot exceed ƒ${max.toLocaleString()}.`);
  }

  return Math.round(requestedAmount * 100) / 100;
}

export async function quotePaymentLinkPayment(
  user: AltaUser,
  slug: string,
  amount?: number,
): Promise<PaymentLinkPaymentQuote> {
  const link = await loadPaymentLinkForPayment(slug);
  if (!link) notFound();

  const grossAmount = resolvePayAmount(link, amount);
  const fees = await quotePaymentLinkFees(grossAmount, link.merchantCompanyId);

  return {
    slug: link.slug,
    merchantName: link.merchantCompany.name,
    description: link.description,
    amount: grossAmount,
    feeAmount: fees.feeAmount,
    totalDebited: fees.totalDebited,
    netToMerchant: fees.netAmount,
  };
}

export async function payPaymentLink(
  user: AltaUser,
  input: PayPaymentLinkInput,
  auditContext?: BankingStaffAuditContext,
): Promise<PayPaymentLinkResult> {
  if (!input.idempotencyKey.trim()) badRequest("Idempotency key is required.");

  const existingAttempt = await prisma.paymentLinkPayment.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: {
      paymentLink: { include: { merchantCompany: true } },
      payment: { select: { referenceCode: true } },
    },
  });
  if (existingAttempt?.status === "COMPLETED" && existingAttempt.payment) {
    const sources = await listPayFundingSources(user);
    const source = resolvePayFundingSourceOption(sources, input.fundingSource);
    return {
      slug: existingAttempt.paymentLink.slug,
      paymentReferenceCode: existingAttempt.payment.referenceCode,
      amount: decimalToNumber(existingAttempt.amount),
      feeAmount: decimalToNumber(existingAttempt.feeAmount),
      totalDebited: decimalToNumber(existingAttempt.amount),
      merchantName: existingAttempt.paymentLink.merchantCompany.name,
      fundingSourceLabel: source?.label ?? "Alta Bank account",
    };
  }

  const link = await loadPaymentLinkForPayment(input.slug);
  if (!link) notFound();

  const allowedFunding = await listPayFundingSources(user);
  const selectedFunding = resolvePayFundingSourceOption(allowedFunding, input.fundingSource);

  const grossAmount = resolvePayAmount(link, input.amount);
  const fees = await quotePaymentLinkFees(grossAmount, link.merchantCompanyId);
  const referenceBase = generatePaymentReferenceBase();
  const source = auditContext?.source ?? "website";
  const payerLabel = user.minecraftUsername?.trim() || user.discordUsername;
  const memo = `Payment link ${link.referenceCode}`;

  let fundingSourceLabel = selectedFunding.label;
  let paymentReferenceCode = referenceBase;
  let paymentId = "";

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PaymentLink" WHERE id = ${link.id} FOR UPDATE`;

      const locked = await tx.paymentLink.findUnique({
        where: { id: link.id },
        include: {
          merchantCompany: true,
          destinationAccount: true,
        },
      });
      if (!locked) notFound();
      resolvePayAmount(locked, input.amount);

      if (locked.usageType === "ONE_TIME") {
        const completed = await tx.paymentLinkPayment.findFirst({
          where: { paymentLinkId: locked.id, status: "COMPLETED" },
        });
        if (completed) conflict("This payment link has already been used.");
      }

      const attempt =
        existingAttempt ??
        (await tx.paymentLinkPayment.create({
          data: {
            paymentLinkId: locked.id,
            amount: fees.totalDebited,
            feeAmount: fees.feeAmount,
            idempotencyKey: input.idempotencyKey,
            initiatedByUserId: user.id,
            payerLabel,
            fundingSource: input.fundingSource as PaymentLinkFundingSource,
            source,
            status: "PENDING",
          },
        }));

      if (attempt.status === "FAILED") {
        await tx.paymentLinkPayment.update({
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

        if (sourceAccount.id === locked.destinationAccountId) {
          badRequest("Cannot pay a merchant from their own operating account.");
        }
        if (
          sourceAccount.companyId &&
          sourceAccount.companyId === locked.merchantCompanyId
        ) {
          badRequest("Cannot pay this merchant from the merchant company's operating account.");
        }

        fundingSourceLabel = sourceAccount.accountName;

        settlement = await settleToCompanyOperatingAccountInTx(tx, {
          paymentType: "PAYMENT_LINK",
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
            paymentLinkId: locked.id,
            paymentLinkSlug: locked.slug,
            paymentLinkReference: locked.referenceCode,
            feeAmount: fees.feeAmount,
            netAmount: fees.netAmount,
          },
          outDescription: `Payment link to ${locked.merchantCompany.name}`,
          inDescription: `Payment link from ${resolvedPayerLabel}`,
        });
      } else {
        if (selectedFunding.employerCompanyId === locked.merchantCompanyId) {
          badRequest("You cannot use this Alta Card to pay the company it belongs to.");
        }

        const cardSettlement = await settleCommercialPaymentFromAltaCardInTx(tx, {
          paymentType: "PAYMENT_LINK",
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
            paymentLinkId: locked.id,
            paymentLinkSlug: locked.slug,
            paymentLinkReference: locked.referenceCode,
            feeAmount: fees.feeAmount,
            netAmount: fees.netAmount,
          },
          inDescription: `Payment link from ${user.discordUsername}`,
        });
        settlement = cardSettlement;
        fundingSourceLabel = cardSettlement.fundingSourceLabel;
        resolvedPayerLabel = user.discordUsername;
      }

      paymentId = settlement.paymentId;
      paymentReferenceCode = settlement.referenceBase;

      const now = new Date();
      await tx.paymentLinkPayment.update({
        where: { id: attempt.id },
        data: {
          status: "COMPLETED",
          paymentId: settlement.paymentId,
          transferGroupId: settlement.transferGroupId,
          payerLabel: resolvedPayerLabel,
          completedAt: now,
        },
      });

      const nextStatus =
        locked.usageType === "ONE_TIME"
          ? "COMPLETED"
          : locked.status;

      await tx.paymentLink.update({
        where: { id: locked.id },
        data: {
          status: nextStatus,
          completedAt: locked.usageType === "ONE_TIME" ? now : locked.completedAt,
          paymentCount: { increment: 1 },
          totalCollected: { increment: fees.totalDebited },
        },
      });

      return { locked, settlement, resolvedPayerLabel, paidAt: now };
    });

    await recordPaymentLinkPaidAudit({
      actorUserId: user.id,
      paymentLinkId: result.locked.id,
      merchantCompanyId: result.locked.merchantCompanyId,
      merchantName: result.locked.merchantCompany.name,
      slug: result.locked.slug,
      referenceCode: result.locked.referenceCode,
      payerLabel: result.resolvedPayerLabel,
      amount: fees.totalDebited,
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
        source: "payment_link",
        referenceCode: paymentReferenceCode,
        amount: fees.totalDebited,
        customerLabel: result.resolvedPayerLabel,
        entityId: result.locked.id,
        auditSource: source,
      });
    } catch (auditError) {
      console.error("[payment-link] commercial payment received audit failed", auditError);
    }

    void (async () => {
      try {
        const { notifyPaymentLinkPaid } = await import(
          "@/server/payment-link-notification.service"
        );
        await notifyPaymentLinkPaid({
          paymentLinkId: result.locked.id,
          paymentId,
          payerUserId: user.id,
          amount: fees.totalDebited,
        });
      } catch (error) {
        console.error("[payment-link] paid notification failed", error);
      }

      try {
        const { notifyMerchantFirstPaymentReceivedBestEffort } = await import(
          "@/server/commercial-notification.service"
        );
        await notifyMerchantFirstPaymentReceivedBestEffort({
          companyId: result.locked.merchantCompanyId,
          merchantName: result.locked.merchantCompany.name,
          amount: fees.totalDebited,
          source: "payment_link",
        });
      } catch (error) {
        console.error("[payment-link] first payment notification failed", error);
      }
    })();

    try {
      const { maybeAlertHighValuePaymentLinkPaid } = await import(
        "@/server/payment-link-staff-audit.service"
      );
      await maybeAlertHighValuePaymentLinkPaid({
        paymentLinkId: result.locked.id,
        referenceCode: result.locked.referenceCode,
        merchantCompanyId: result.locked.merchantCompanyId,
        merchantName: result.locked.merchantCompany.name,
        amount: fees.totalDebited,
      });
    } catch (error) {
      console.error("[payment-link] staff alert failed", error);
    }

    void (async () => {
      const { refreshUserRelationshipProfileBestEffort, refreshCompanyRelationshipStackBestEffort } =
        await import("@/server/relationship-refresh-hooks.service");
      try {
        await refreshUserRelationshipProfileBestEffort(user.id, "payment-link-paid");
        await refreshCompanyRelationshipStackBestEffort(
          result.locked.merchantCompanyId,
          "payment-link-paid",
        );
      } catch (error) {
        console.error("[payment-link] relationship refresh failed", error);
      }
    })();

    return {
      slug: result.locked.slug,
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

    await prisma.paymentLinkPayment.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        paymentLinkId: link.id,
        amount: fees.totalDebited,
        feeAmount: fees.feeAmount,
        idempotencyKey: input.idempotencyKey,
        initiatedByUserId: user.id,
        payerLabel,
        fundingSource: input.fundingSource,
        source,
        status: "FAILED",
        failureReason,
      },
      update: {},
    });
    await prisma.paymentLinkPayment.updateMany({
      where: {
        idempotencyKey: input.idempotencyKey,
        status: { not: "COMPLETED" },
      },
      data: {
        status: "FAILED",
        failureReason,
      },
    });
    const completedRow = await prisma.paymentLinkPayment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (completedRow?.status === "COMPLETED" && completedRow.paymentId) {
      const sources = await listPayFundingSources(user);
      const sourceLabel = resolvePayFundingSourceOption(sources, input.fundingSource);
      const payment = await prisma.payment.findUnique({
        where: { id: completedRow.paymentId },
        select: { referenceCode: true },
      });
      if (payment) {
        return {
          slug: link.slug,
          paymentReferenceCode: payment.referenceCode,
          amount: decimalToNumber(completedRow.amount),
          feeAmount: decimalToNumber(completedRow.feeAmount),
          totalDebited: decimalToNumber(completedRow.amount),
          merchantName: link.merchantCompany.name,
          fundingSourceLabel: sourceLabel?.label ?? "Alta Bank account",
        };
      }
    }

    await writePaymentLinkAudit({
      actorUserId: user.id,
      action: "PAYMENT_LINK_PAYMENT_FAILED",
      paymentLinkId: link.id,
      merchantCompanyId: link.merchantCompanyId,
      slug: link.slug,
      referenceCode: link.referenceCode,
      source,
      metadata: { failureReason, idempotencyKey: input.idempotencyKey },
    });
    await appendPaymentLinkEvent({
      paymentLinkId: link.id,
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
        companyId: link.merchantCompanyId,
        source: "payment_link",
        referenceCode: link.referenceCode,
        amount: grossAmount,
        customerLabel: payerLabel,
        entityId: link.id,
        failureReason,
        auditSource: source,
      });
      const merchantUserIds = await listMerchantFinanceUserIds(link.merchantCompanyId);
      await notifyMerchantPaymentFailed({
        companyId: link.merchantCompanyId,
        merchantUserIds,
        title: "Payment link payment failed",
        body: `A payment attempt for link ${link.referenceCode} (${`ƒ${grossAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}) could not be completed. ${failureReason}`,
        linkUrl: `/bank/commercial/payment-links/${link.id}?companyId=${link.merchantCompanyId}`,
        metadata: { paymentLinkId: link.id, failureReason },
      });

      const { notifyPayerPaymentFailedBestEffort } = await import("@/server/commercial-notification.service");
      await notifyPayerPaymentFailedBestEffort({
        payerUserId: user.id,
        merchantName: link.merchantCompany.name,
        amount: grossAmount,
        referenceCode: link.referenceCode,
        reason: failureReason,
        tryAgainUrl: `/pay/${link.slug}`,
        source: "payment_link",
      });
    } catch (notifyError) {
      console.error("[payment-link] merchant payment failed notification error", notifyError);
    }

    try {
      const { alertPaymentLinkPaymentFailed } = await import(
        "@/server/payment-link-staff-audit.service"
      );
      await alertPaymentLinkPaymentFailed(
        link.id,
        link.referenceCode,
        link.merchantCompany.name,
        failureReason,
      );
    } catch (staffError) {
      console.error("[payment-link] staff payment failed alert error", staffError);
    }

    if (message.startsWith("BAD_REQUEST:")) badRequest(failureReason);
    if (message.startsWith("CONFLICT:")) conflict(failureReason);
    if (message === "FORBIDDEN") forbidden();
    if (message === "NOT_FOUND") notFound();
    throw error;
  }
}
