import { prisma } from "@/server/db";

export type PaymentLinkFeeConfig = {
  enabled: boolean;
  type: "percent" | "flat";
  value: number;
  minFee?: number;
  maxFee?: number;
};

const DEFAULT_FEE_CONFIG: PaymentLinkFeeConfig = {
  enabled: false,
  type: "percent",
  value: 0,
};

export type PaymentLinkFeeBreakdown = {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  totalDebited: number;
};

export async function getPaymentLinkFeeConfig(companyId?: string): Promise<PaymentLinkFeeConfig> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: "payment_link.default_fee" },
  });
  const base =
    setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
      ? ({ ...DEFAULT_FEE_CONFIG, ...(setting.value as Partial<PaymentLinkFeeConfig>) })
      : DEFAULT_FEE_CONFIG;

  if (!companyId) return base;

  const overrides = await prisma.platformSetting.findUnique({
    where: { key: "payment_link.company_overrides" },
  });
  if (
    overrides?.value &&
    typeof overrides.value === "object" &&
    !Array.isArray(overrides.value) &&
    companyId in (overrides.value as Record<string, unknown>)
  ) {
    const companyOverride = (overrides.value as Record<string, Partial<PaymentLinkFeeConfig>>)[
      companyId
    ];
    if (companyOverride) {
      return { ...base, ...companyOverride };
    }
  }

  return base;
}

export function computePaymentLinkFee(
  grossAmount: number,
  config: PaymentLinkFeeConfig,
): PaymentLinkFeeBreakdown {
  if (!config.enabled || grossAmount <= 0) {
    return {
      grossAmount,
      feeAmount: 0,
      netAmount: grossAmount,
      totalDebited: grossAmount,
    };
  }

  let feeAmount = config.type === "flat" ? config.value : (grossAmount * config.value) / 100;
  if (config.minFee != null) feeAmount = Math.max(feeAmount, config.minFee);
  if (config.maxFee != null) feeAmount = Math.min(feeAmount, config.maxFee);
  feeAmount = Math.round(feeAmount * 100) / 100;

  const netAmount = Math.round((grossAmount - feeAmount) * 100) / 100;
  return {
    grossAmount,
    feeAmount,
    netAmount,
    totalDebited: grossAmount,
  };
}

export async function quotePaymentLinkFees(
  grossAmount: number,
  companyId: string,
): Promise<PaymentLinkFeeBreakdown> {
  const config = await getPaymentLinkFeeConfig(companyId);
  return computePaymentLinkFee(grossAmount, config);
}
