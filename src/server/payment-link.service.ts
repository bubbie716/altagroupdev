import { randomBytes } from "node:crypto";
import type { AltaUser } from "@/lib/auth/types";
import {
  canManagePaymentLinks,
  canViewPaymentLinks,
} from "@/lib/auth/permissions";
import {
  PAYMENT_LINK_REFERENCE_PREFIX,
  type CreatePaymentLinkInput,
  type PaymentLinkCheckoutContext,
  type PaymentLinkDashboard,
  type PaymentLinkDetail,
  type PaymentLinkSummaryRow,
  type UpdatePaymentLinkInput,
} from "@/lib/bank/payment-link-types";
import type { PaymentLinkStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  appendPaymentLinkEvent,
  mapAuditActionToPaymentLinkEventType,
  writePaymentLinkAudit,
} from "@/server/payment-link-audit.service";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function decimalToNumber(value: { toString(): string } | null | undefined): number | null {
  if (value == null) return null;
  return Number(value.toString());
}

function generateReferenceCode(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${PAYMENT_LINK_REFERENCE_PREFIX}${date}-${suffix}`;
}

async function generateUniqueSlug(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = randomBytes(6).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toLowerCase();
    const candidate = slug.length >= 8 ? slug : `${slug}${randomBytes(2).toString("hex")}`;
    const existing = await prisma.paymentLink.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  badRequest("Could not generate a unique link. Please try again.");
}

async function assertVerifiedCompanyWithOperatingAccount(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      bankAccounts: {
        where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        take: 1,
      },
    },
  });
  if (!company || company.verificationStatus !== "VERIFIED") {
    badRequest("Company must be verified to manage payment links.");
  }
  const operating = company.bankAccounts[0];
  if (!operating) {
    badRequest("Company must have an active Business Operating Account.");
  }
  return { company, operatingAccount: operating };
}

function requireManage(user: AltaUser, companyId: string): void {
  if (!canManagePaymentLinks(user, { companyId })) forbidden();
}

function requireView(user: AltaUser, companyId: string): void {
  if (!canViewPaymentLinks(user, { companyId })) forbidden();
}

function checkoutUrl(slug: string): string {
  return `/pay/${slug}`;
}

function validateCreateInput(input: CreatePaymentLinkInput): void {
  if (!input.description.trim()) badRequest("Description is required.");
  if (input.amountType === "FIXED") {
    if (input.amount == null || input.amount <= 0) {
      badRequest("Fixed amount links require an amount greater than zero.");
    }
  } else {
    if (input.amount != null && input.amount <= 0) badRequest("Amount must be greater than zero.");
    const min = input.minAmount ?? null;
    const max = input.maxAmount ?? null;
    if (min != null && min <= 0) badRequest("Minimum amount must be greater than zero.");
    if (max != null && max <= 0) badRequest("Maximum amount must be greater than zero.");
    if (min != null && max != null && min > max) {
      badRequest("Minimum amount cannot exceed maximum amount.");
    }
  }
}

export async function resolvePaymentLinkEffectiveStatus(link: {
  status: PaymentLinkStatus;
  expiresAt: Date | null;
}): Promise<PaymentLinkStatus> {
  if (link.status !== "ACTIVE" && link.status !== "PAUSED") return link.status;
  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
    return "EXPIRED";
  }
  return link.status;
}

export async function markPaymentLinkExpiredIfNeeded(
  linkId: string,
  actorUserId?: string,
): Promise<void> {
  const link = await prisma.paymentLink.findUnique({ where: { id: linkId } });
  if (!link || link.status !== "ACTIVE") return;
  if (!link.expiresAt || link.expiresAt.getTime() > Date.now()) return;

  await prisma.paymentLink.update({
    where: { id: linkId },
    data: { status: "EXPIRED" },
  });

  await appendPaymentLinkEvent({
    paymentLinkId: linkId,
    eventType: "EXPIRED",
    actorUserId: actorUserId ?? null,
    source: "system",
    metadata: { expiredAt: new Date().toISOString() },
  });
}

const linkInclude = {
  merchantCompany: { select: { name: true } },
  payments: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: { payment: { select: { referenceCode: true } } },
  },
  events: { orderBy: { createdAt: "desc" as const }, take: 50 },
} as const;

function mapSummary(link: {
  id: string;
  slug: string;
  referenceCode: string;
  merchantCompanyId: string;
  merchantCompany: { name: string };
  title: string | null;
  description: string;
  amountType: PaymentLinkSummaryRow["amountType"];
  usageType: PaymentLinkSummaryRow["usageType"];
  amount: { toString(): string } | null;
  minAmount: { toString(): string } | null;
  maxAmount: { toString(): string } | null;
  currency: string;
  status: PaymentLinkStatus;
  expiresAt: Date | null;
  paymentCount: number;
  totalCollected: { toString(): string };
  createdAt: Date;
}): PaymentLinkSummaryRow {
  return {
    id: link.id,
    slug: link.slug,
    referenceCode: link.referenceCode,
    merchantCompanyId: link.merchantCompanyId,
    merchantName: link.merchantCompany.name,
    title: link.title,
    description: link.description,
    amountType: link.amountType,
    usageType: link.usageType,
    amount: decimalToNumber(link.amount),
    minAmount: decimalToNumber(link.minAmount),
    maxAmount: decimalToNumber(link.maxAmount),
    currency: link.currency,
    status: link.status,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    paymentCount: link.paymentCount,
    totalCollected: decimalToNumber(link.totalCollected) ?? 0,
    createdAt: link.createdAt.toISOString(),
    checkoutUrl: checkoutUrl(link.slug),
  };
}

function mapDetail(link: {
  id: string;
  slug: string;
  referenceCode: string;
  merchantCompanyId: string;
  merchantCompany: { name: string };
  title: string | null;
  description: string;
  internalMemo: string | null;
  amountType: PaymentLinkSummaryRow["amountType"];
  usageType: PaymentLinkSummaryRow["usageType"];
  amount: { toString(): string } | null;
  minAmount: { toString(): string } | null;
  maxAmount: { toString(): string } | null;
  currency: string;
  status: PaymentLinkStatus;
  expiresAt: Date | null;
  paymentCount: number;
  totalCollected: { toString(): string };
  pausedAt: Date | null;
  cancelledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  payments: Array<{
    id: string;
    amount: { toString(): string };
    feeAmount: { toString(): string };
    payerLabel: string | null;
    status: string;
    completedAt: Date | null;
    createdAt: Date;
    payment: { referenceCode: string } | null;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    actorUserId: string | null;
    source: string;
    metadata: unknown;
    createdAt: Date;
  }>;
}): PaymentLinkDetail {
  return {
    ...mapSummary(link),
    internalMemo: link.internalMemo,
    pausedAt: link.pausedAt?.toISOString() ?? null,
    cancelledAt: link.cancelledAt?.toISOString() ?? null,
    completedAt: link.completedAt?.toISOString() ?? null,
    recentPayments: link.payments.map((payment) => ({
      id: payment.id,
      amount: decimalToNumber(payment.amount) ?? 0,
      feeAmount: decimalToNumber(payment.feeAmount) ?? 0,
      payerLabel: payment.payerLabel,
      paymentReferenceCode: payment.payment?.referenceCode ?? null,
      status: payment.status,
      completedAt: payment.completedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    })),
    events: link.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      actorUserId: event.actorUserId,
      source: event.source,
      metadata:
        event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
          ? (event.metadata as Record<string, unknown>)
          : null,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function createPaymentLink(
  user: AltaUser,
  input: CreatePaymentLinkInput,
  source = "website",
): Promise<PaymentLinkDetail> {
  requireManage(user, input.companyId);
  validateCreateInput(input);
  const { assertCommercialPaymentLinkLimit } = await import("@/server/commercial-limits.service");
  await assertCommercialPaymentLinkLimit(input.companyId);
  const { company, operatingAccount } = await assertVerifiedCompanyWithOperatingAccount(
    input.companyId,
  );

  const slug = await generateUniqueSlug();
  const referenceCode = generateReferenceCode();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  const link = await prisma.paymentLink.create({
    data: {
      slug,
      referenceCode,
      merchantCompanyId: company.id,
      destinationAccountId: operatingAccount.id,
      title: input.title?.trim() || null,
      description: input.description.trim(),
      internalMemo: input.internalMemo?.trim() || null,
      amountType: input.amountType,
      usageType: input.usageType,
      amount: input.amountType === "FIXED" ? input.amount : null,
      minAmount: input.amountType === "OPEN" ? (input.minAmount ?? null) : null,
      maxAmount: input.amountType === "OPEN" ? (input.maxAmount ?? null) : null,
      expiresAt,
      createdByUserId: user.id,
    },
    include: linkInclude,
  });

  await writePaymentLinkAudit({
    actorUserId: user.id,
    action: "PAYMENT_LINK_CREATED",
    paymentLinkId: link.id,
    merchantCompanyId: company.id,
    slug: link.slug,
    referenceCode: link.referenceCode,
    source,
    description: `Payment link ${link.referenceCode} created`,
    metadata: {
      amountType: link.amountType,
      usageType: link.usageType,
      checkoutUrl: checkoutUrl(link.slug),
    },
  });
  await appendPaymentLinkEvent({
    paymentLinkId: link.id,
    eventType: mapAuditActionToPaymentLinkEventType("PAYMENT_LINK_CREATED"),
    actorUserId: user.id,
    source,
  });

  return mapDetail(link);
}

export async function updatePaymentLink(
  user: AltaUser,
  input: UpdatePaymentLinkInput,
  source = "website",
): Promise<PaymentLinkDetail> {
  requireManage(user, input.companyId);
  const existing = await prisma.paymentLink.findFirst({
    where: { id: input.linkId, merchantCompanyId: input.companyId },
  });
  if (!existing) notFound();
  if (!["ACTIVE", "PAUSED"].includes(existing.status)) {
    badRequest("Only active or paused links can be edited.");
  }

  const link = await prisma.paymentLink.update({
    where: { id: existing.id },
    data: {
      title: input.title === undefined ? undefined : input.title?.trim() || null,
      description: input.description?.trim(),
      internalMemo: input.internalMemo === undefined ? undefined : input.internalMemo?.trim() || null,
      amount:
        existing.amountType === "FIXED" && input.amount != null ? input.amount : undefined,
      minAmount:
        existing.amountType === "OPEN" && input.minAmount !== undefined
          ? input.minAmount
          : undefined,
      maxAmount:
        existing.amountType === "OPEN" && input.maxAmount !== undefined
          ? input.maxAmount
          : undefined,
      expiresAt:
        input.expiresAt === undefined
          ? undefined
          : input.expiresAt
            ? new Date(input.expiresAt)
            : null,
    },
    include: linkInclude,
  });

  await writePaymentLinkAudit({
    actorUserId: user.id,
    action: "PAYMENT_LINK_UPDATED",
    paymentLinkId: link.id,
    merchantCompanyId: link.merchantCompanyId,
    slug: link.slug,
    referenceCode: link.referenceCode,
    source,
  });
  await appendPaymentLinkEvent({
    paymentLinkId: link.id,
    eventType: "UPDATED",
    actorUserId: user.id,
    source,
  });

  return mapDetail(link);
}

export async function pausePaymentLink(
  user: AltaUser,
  companyId: string,
  linkId: string,
  source = "website",
): Promise<PaymentLinkDetail> {
  requireManage(user, companyId);
  const existing = await prisma.paymentLink.findFirst({
    where: { id: linkId, merchantCompanyId: companyId },
  });
  if (!existing) notFound();
  if (existing.status !== "ACTIVE") badRequest("Only active links can be paused.");

  const link = await prisma.paymentLink.update({
    where: { id: existing.id },
    data: { status: "PAUSED", pausedAt: new Date() },
    include: linkInclude,
  });

  await writePaymentLinkAudit({
    actorUserId: user.id,
    action: "PAYMENT_LINK_PAUSED",
    paymentLinkId: link.id,
    merchantCompanyId: companyId,
    slug: link.slug,
    referenceCode: link.referenceCode,
    source,
  });
  await appendPaymentLinkEvent({
    paymentLinkId: link.id,
    eventType: "PAUSED",
    actorUserId: user.id,
    source,
  });

  return mapDetail(link);
}

export async function activatePaymentLink(
  user: AltaUser,
  companyId: string,
  linkId: string,
  source = "website",
): Promise<PaymentLinkDetail> {
  requireManage(user, companyId);
  const existing = await prisma.paymentLink.findFirst({
    where: { id: linkId, merchantCompanyId: companyId },
  });
  if (!existing) notFound();
  if (existing.status !== "PAUSED") badRequest("Only paused links can be activated.");
  if (existing.expiresAt && existing.expiresAt.getTime() <= Date.now()) {
    badRequest("This link has expired and cannot be reactivated.");
  }

  const link = await prisma.paymentLink.update({
    where: { id: existing.id },
    data: { status: "ACTIVE", pausedAt: null },
    include: linkInclude,
  });

  await writePaymentLinkAudit({
    actorUserId: user.id,
    action: "PAYMENT_LINK_ACTIVATED",
    paymentLinkId: link.id,
    merchantCompanyId: companyId,
    slug: link.slug,
    referenceCode: link.referenceCode,
    source,
  });
  await appendPaymentLinkEvent({
    paymentLinkId: link.id,
    eventType: "ACTIVATED",
    actorUserId: user.id,
    source,
  });

  return mapDetail(link);
}

export async function cancelPaymentLink(
  user: AltaUser,
  companyId: string,
  linkId: string,
  source = "website",
): Promise<PaymentLinkDetail> {
  requireManage(user, companyId);
  const existing = await prisma.paymentLink.findFirst({
    where: { id: linkId, merchantCompanyId: companyId },
  });
  if (!existing) notFound();
  if (["CANCELLED", "COMPLETED", "EXPIRED"].includes(existing.status)) {
    badRequest("This link cannot be cancelled.");
  }

  const link = await prisma.paymentLink.update({
    where: { id: existing.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    include: linkInclude,
  });

  await writePaymentLinkAudit({
    actorUserId: user.id,
    action: "PAYMENT_LINK_CANCELLED",
    paymentLinkId: link.id,
    merchantCompanyId: companyId,
    slug: link.slug,
    referenceCode: link.referenceCode,
    source,
  });
  await appendPaymentLinkEvent({
    paymentLinkId: link.id,
    eventType: "CANCELLED",
    actorUserId: user.id,
    source,
  });

  return mapDetail(link);
}

export async function getPaymentLinkDashboard(
  user: AltaUser,
  companyId: string,
): Promise<PaymentLinkDashboard> {
  requireView(user, companyId);

  const [activeCount, aggregates, recent] = await Promise.all([
    prisma.paymentLink.count({
      where: { merchantCompanyId: companyId, status: "ACTIVE" },
    }),
    prisma.paymentLink.aggregate({
      where: { merchantCompanyId: companyId },
      _sum: { totalCollected: true, paymentCount: true },
    }),
    prisma.paymentLink.findMany({
      where: { merchantCompanyId: companyId },
      include: { merchantCompany: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    activeCount,
    totalCollected: decimalToNumber(aggregates._sum.totalCollected) ?? 0,
    paymentCount: aggregates._sum.paymentCount ?? 0,
    recent: recent.map((link) =>
      mapSummary({ ...link, merchantCompany: link.merchantCompany }),
    ),
  };
}

export async function getPaymentLinkDetail(
  user: AltaUser,
  companyId: string,
  linkId: string,
): Promise<PaymentLinkDetail> {
  requireView(user, companyId);
  const link = await prisma.paymentLink.findFirst({
    where: { id: linkId, merchantCompanyId: companyId },
    include: linkInclude,
  });
  if (!link) notFound();
  await markPaymentLinkExpiredIfNeeded(link.id, user.id);
  const refreshed = await prisma.paymentLink.findFirst({
    where: { id: linkId, merchantCompanyId: companyId },
    include: linkInclude,
  });
  if (!refreshed) notFound();
  return mapDetail(refreshed);
}

export async function getPaymentLinkCheckoutContext(
  slug: string,
): Promise<PaymentLinkCheckoutContext> {
  const link = await prisma.paymentLink.findUnique({
    where: { slug },
    include: { merchantCompany: { select: { name: true, verificationStatus: true } } },
  });
  if (!link) notFound();

  await markPaymentLinkExpiredIfNeeded(link.id);
  const effectiveStatus = await resolvePaymentLinkEffectiveStatus(link);
  if (effectiveStatus === "EXPIRED" && link.status === "ACTIVE") {
    await prisma.paymentLink.update({ where: { id: link.id }, data: { status: "EXPIRED" } });
  }

  const refreshed = await prisma.paymentLink.findUnique({ where: { slug } });
  const status = refreshed?.status ?? effectiveStatus;

  let payable = status === "ACTIVE";
  let statusMessage: string | null = null;
  if (status === "PAUSED") {
    payable = false;
    statusMessage = "This payment link is temporarily paused.";
  } else if (status === "EXPIRED") {
    payable = false;
    statusMessage = "This payment link has expired.";
  } else if (status === "COMPLETED") {
    payable = false;
    statusMessage = "This one-time payment link has already been used.";
  } else if (status === "CANCELLED") {
    payable = false;
    statusMessage = "This payment link is no longer available.";
  } else if (link.merchantCompany.verificationStatus !== "VERIFIED") {
    payable = false;
    statusMessage = "This merchant is not available to receive payments.";
  }

  return {
    slug: link.slug,
    merchantName: link.merchantCompany.name,
    title: link.title,
    description: link.description,
    amountType: link.amountType,
    usageType: link.usageType,
    amount: decimalToNumber(link.amount),
    minAmount: decimalToNumber(link.minAmount),
    maxAmount: decimalToNumber(link.maxAmount),
    currency: link.currency,
    status,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    payable,
    statusMessage,
    branding: await (async () => {
      const { resolveBrandingForMerchantCompany } = await import(
        "@/server/company-branding.service"
      );
      return resolveBrandingForMerchantCompany(link.merchantCompanyId);
    })(),
  };
}

export async function loadPaymentLinkForPayment(slug: string) {
  const link = await prisma.paymentLink.findUnique({
    where: { slug },
    include: {
      merchantCompany: true,
      destinationAccount: true,
    },
  });
  if (!link) notFound();
  await markPaymentLinkExpiredIfNeeded(link.id);
  return prisma.paymentLink.findUnique({
    where: { slug },
    include: {
      merchantCompany: true,
      destinationAccount: true,
    },
  });
}
