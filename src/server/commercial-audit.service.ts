import { auditSourceMetadata } from "@/lib/internal/audit-metadata";
import type { CommercialFeatureKey, CommercialPlan } from "@/lib/bank/commercial-banking-types";
import { prisma } from "@/server/db";

export type CommercialAuditAction =
  | "COMMERCIAL_PLAN_CHANGED"
  | "COMMERCIAL_FEATURE_ENABLED"
  | "COMMERCIAL_FEATURE_DISABLED"
  | "MERCHANT_PAYMENT_RECEIVED"
  | "MERCHANT_PAYMENT_FAILED"
  | "COMMERCIAL_PRO_PURCHASED"
  | "COMMERCIAL_PRO_PURCHASE_FAILED"
  | "COMMERCIAL_PRO_BILLING_SUCCEEDED"
  | "COMMERCIAL_PRO_BILLING_FAILED"
  | "COMMERCIAL_PRO_PAST_DUE"
  | "COMMERCIAL_PRO_DOWNGRADED"
  | "COMMERCIAL_BILLING_ACCOUNT_CHANGED"
  | "COMMERCIAL_PLAN_SETTING_CHANGED";

async function writeCommercialAudit(input: {
  actorUserId: string;
  action: CommercialAuditAction | string;
  companyId?: string;
  entityType?: "COMPANY" | "PLATFORM";
  entityId?: string;
  description: string;
  source: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType ?? "COMPANY",
    entityId: input.entityId ?? input.companyId ?? "commercial",
    targetCompanyId: input.companyId,
    description: input.description,
    metadata: auditSourceMetadata(input.source, input.metadata ?? {}),
  });
}

export async function recordCommercialPlanChangedAudit(input: {
  actorUserId: string;
  companyId: string;
  previousPlan: CommercialPlan;
  nextPlan: CommercialPlan;
  source: string;
}): Promise<void> {
  await writeCommercialAudit({
    actorUserId: input.actorUserId,
    action: "COMMERCIAL_PLAN_CHANGED",
    companyId: input.companyId,
    source: input.source,
    description: `Commercial plan changed from ${input.previousPlan} to ${input.nextPlan}`,
    metadata: {
      previousPlan: input.previousPlan,
      nextPlan: input.nextPlan,
    },
  });
}

export async function recordCommercialFeatureTogglesAudit(input: {
  actorUserId: string;
  companyId: string;
  enabled: CommercialFeatureKey[];
  disabled: CommercialFeatureKey[];
  source: string;
}): Promise<void> {
  for (const feature of input.enabled) {
    await writeCommercialAudit({
      actorUserId: input.actorUserId,
      action: "COMMERCIAL_FEATURE_ENABLED",
      companyId: input.companyId,
      source: input.source,
      description: `Commercial feature enabled: ${feature}`,
      metadata: { feature },
    });
  }
  for (const feature of input.disabled) {
    await writeCommercialAudit({
      actorUserId: input.actorUserId,
      action: "COMMERCIAL_FEATURE_DISABLED",
      companyId: input.companyId,
      source: input.source,
      description: `Commercial feature disabled: ${feature}`,
      metadata: { feature },
    });
  }
}

export async function recordCommercialProPurchasedAudit(input: {
  actorUserId: string;
  companyId: string;
  billingAccountId: string;
  amount: number;
  transactionId: string;
  referenceCode: string;
  nextBillingAt: string;
  source: string;
}): Promise<void> {
  await writeCommercialAudit({
    actorUserId: input.actorUserId,
    action: "COMMERCIAL_PRO_PURCHASED",
    companyId: input.companyId,
    source: input.source,
    description: `Alta Commercial Pro activated · ${input.referenceCode}`,
    metadata: input,
  });
}

export async function recordCommercialProPurchaseFailedAudit(input: {
  actorUserId: string;
  companyId: string;
  billingAccountId: string;
  amount: number;
  reason: string;
  source: string;
}): Promise<void> {
  await writeCommercialAudit({
    actorUserId: input.actorUserId,
    action: "COMMERCIAL_PRO_PURCHASE_FAILED",
    companyId: input.companyId,
    source: input.source,
    description: "Alta Commercial Pro purchase failed",
    metadata: input,
  });
}

export async function recordCommercialProBillingSucceededAudit(input: {
  actorUserId: string;
  companyId: string;
  billingAccountId: string;
  amount: number;
  transactionId: string;
  referenceCode: string;
  nextBillingAt: string;
  source: string;
}): Promise<void> {
  await writeCommercialAudit({
    actorUserId: input.actorUserId,
    action: "COMMERCIAL_PRO_BILLING_SUCCEEDED",
    companyId: input.companyId,
    source: input.source,
    description: `Alta Commercial Pro billing succeeded · ${input.referenceCode}`,
    metadata: input,
  });
}

export async function recordCommercialProBillingFailedAudit(input: {
  actorUserId: string;
  companyId: string;
  billingAccountId: string;
  amount: number;
  reason: string;
  source: string;
}): Promise<void> {
  await writeCommercialAudit({
    actorUserId: input.actorUserId,
    action: "COMMERCIAL_PRO_BILLING_FAILED",
    companyId: input.companyId,
    source: input.source,
    description: "Alta Commercial Pro billing failed",
    metadata: input,
  });
}

export async function recordCommercialProPastDueAudit(input: {
  actorUserId: string;
  companyId: string;
  billingAccountId: string;
  amount: number;
  pastDueAt: string;
  source: string;
}): Promise<void> {
  await writeCommercialAudit({
    actorUserId: input.actorUserId,
    action: "COMMERCIAL_PRO_PAST_DUE",
    companyId: input.companyId,
    source: input.source,
    description: "Alta Commercial Pro billing is past due",
    metadata: input,
  });
}

export async function recordCommercialProDowngradedAudit(input: {
  actorUserId: string;
  companyId: string;
  reason: string;
  source: string;
}): Promise<void> {
  await writeCommercialAudit({
    actorUserId: input.actorUserId,
    action: "COMMERCIAL_PRO_DOWNGRADED",
    companyId: input.companyId,
    source: input.source,
    description: "Alta Commercial Pro downgraded to Core",
    metadata: input,
  });
}

export async function recordCommercialBillingAccountChangedAudit(input: {
  actorUserId: string;
  companyId: string;
  previousBillingAccountId: string | null;
  nextBillingAccountId: string;
  source: string;
}): Promise<void> {
  await writeCommercialAudit({
    actorUserId: input.actorUserId,
    action: "COMMERCIAL_BILLING_ACCOUNT_CHANGED",
    companyId: input.companyId,
    source: input.source,
    description: "Commercial Pro billing account changed",
    metadata: input,
  });
}

export async function recordMerchantPaymentReceivedAudit(input: {
  actorUserId: string;
  companyId: string;
  source: "invoice" | "payment_link";
  referenceCode: string;
  amount: number;
  customerLabel: string;
  entityId: string;
  auditSource: string;
}): Promise<void> {
  await writeCommercialAudit({
    actorUserId: input.actorUserId,
    action: "MERCHANT_PAYMENT_RECEIVED",
    companyId: input.companyId,
    source: input.auditSource,
    description: `Merchant payment received · ${input.referenceCode}`,
    metadata: {
      source: input.source,
      referenceCode: input.referenceCode,
      amount: input.amount,
      customerLabel: input.customerLabel,
      entityId: input.entityId,
    },
  });
}

export async function recordMerchantPaymentFailedAudit(input: {
  actorUserId: string;
  companyId: string;
  source: "invoice" | "payment_link";
  referenceCode: string;
  amount: number;
  customerLabel: string;
  entityId: string;
  failureReason: string;
  auditSource: string;
}): Promise<void> {
  await writeCommercialAudit({
    actorUserId: input.actorUserId,
    action: "MERCHANT_PAYMENT_FAILED",
    companyId: input.companyId,
    source: input.auditSource,
    description: `Merchant payment failed · ${input.referenceCode}`,
    metadata: {
      source: input.source,
      referenceCode: input.referenceCode,
      amount: input.amount,
      customerLabel: input.customerLabel,
      entityId: input.entityId,
      failureReason: input.failureReason,
    },
  });
}

export async function notifyMerchantPaymentFailed(input: {
  companyId: string;
  merchantUserIds: string[];
  title: string;
  body: string;
  linkUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { createUserNotifications } = await import("@/server/notification.service");
  await createUserNotifications(
    input.merchantUserIds.map((userId) => ({
      userId,
      type: "MERCHANT_PAYMENT_FAILED",
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      metadata: input.metadata,
    })),
  );
}

export async function notifyMerchantPaymentReceived(input: {
  companyId: string;
  merchantUserIds: string[];
  title: string;
  body: string;
  linkUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { createUserNotifications } = await import("@/server/notification.service");
  await createUserNotifications(
    input.merchantUserIds.map((userId) => ({
      userId,
      type: "MERCHANT_INVOICE_PAID" as const,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl,
      metadata: input.metadata,
    })),
  );
}

export async function listMerchantFinanceUserIds(companyId: string): Promise<string[]> {
  const memberships = await prisma.companyMembership.findMany({
    where: {
      companyId,
      role: { in: ["OWNER", "EXECUTIVE", "FINANCE_MANAGER"] },
    },
    select: { userId: true },
  });
  return memberships.map((row) => row.userId);
}

export async function listCommercialBillingNotifyUserIds(companyId: string): Promise<string[]> {
  return listMerchantFinanceUserIds(companyId);
}
