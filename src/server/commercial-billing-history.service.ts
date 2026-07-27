import type { AltaUser } from "@/lib/auth/types";
import {
  COMMERCIAL_CHARGE_STATUS_LABELS,
  COMMERCIAL_CHARGE_TYPE_LABELS,
  formatCommercialBillingPeriodLabel,
  type CommercialSubscriptionBillingHistory,
  type CommercialSubscriptionChargeHistoryRow,
} from "@/lib/bank/commercial-billing-history-types";
import { prisma } from "@/server/db";
import { canManageCommercialPlan, resolveCommercialBankingContext } from "@/server/commercial-plan.service";
import { toCustomerSafePaymentFailureReason } from "@/lib/bank/customer-payment-failure-reason";

const DEFAULT_LIMIT = 24;

function decimalToNumber(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value.toString());
}

function mapChargeStatus(
  status: string,
): CommercialSubscriptionChargeHistoryRow["status"] {
  if (status === "FAILED") return "FAILED";
  if (status === "PENDING") return "PENDING";
  return "SUCCEEDED";
}

function mapChargeType(
  chargeType: string,
): CommercialSubscriptionChargeHistoryRow["chargeType"] {
  return chargeType === "INITIAL_PURCHASE" ? "INITIAL_PURCHASE" : "MONTHLY_RENEWAL";
}

export async function listCommercialSubscriptionBillingHistory(
  user: AltaUser,
  companyId: string,
  options?: { limit?: number },
): Promise<CommercialSubscriptionBillingHistory> {
  await resolveCommercialBankingContext(user, companyId);
  if (!canManageCommercialPlan(user, companyId)) {
    throw new Error("FORBIDDEN");
  }

  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), 50);
  const [company, charges] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { commercialNextBillingAt: true },
    }),
    prisma.commercialSubscriptionCharge.findMany({
      where: { companyId },
      include: {
        billingAccount: {
          select: {
            id: true,
            accountName: true,
            accountNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const rows: CommercialSubscriptionChargeHistoryRow[] = charges.map((charge) => {
    const chargeType = mapChargeType(charge.chargeType);
    const status = mapChargeStatus(charge.status);
    return {
      id: charge.id,
      chargeType,
      chargeTypeLabel: COMMERCIAL_CHARGE_TYPE_LABELS[chargeType],
      billingPeriod: charge.billingPeriod,
      billingPeriodLabel: formatCommercialBillingPeriodLabel(charge.billingPeriod),
      amount: decimalToNumber(charge.amount),
      status,
      statusLabel: COMMERCIAL_CHARGE_STATUS_LABELS[status],
      createdAt: charge.createdAt.toISOString(),
      referenceCode: charge.referenceCode,
      billingAccountId: charge.billingAccountId,
      billingAccountName: charge.billingAccount.accountName,
      billingAccountNumber: charge.billingAccount.accountNumber,
      failureReason:
        status === "FAILED" && charge.failureReason
          ? toCustomerSafePaymentFailureReason(charge.failureReason)
          : null,
    };
  });

  return {
    companyId,
    nextBillingAt: company?.commercialNextBillingAt?.toISOString() ?? null,
    charges: rows,
  };
}
