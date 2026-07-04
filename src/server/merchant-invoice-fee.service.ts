import { prisma } from "@/server/db";

export type MerchantInvoiceFeeConfig = {
  enabled: boolean;
  type: "percent" | "flat";
  value: number;
  minFee?: number;
  maxFee?: number;
};

const DEFAULT_FEE_CONFIG: MerchantInvoiceFeeConfig = {
  enabled: false,
  type: "percent",
  value: 0,
};

export type MerchantInvoiceFeeBreakdown = {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  totalDebited: number;
};

export async function getMerchantInvoiceFeeConfig(
  companyId?: string,
): Promise<MerchantInvoiceFeeConfig> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: "merchant_invoice.default_fee" },
  });
  const base =
    setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
      ? ({ ...DEFAULT_FEE_CONFIG, ...(setting.value as Partial<MerchantInvoiceFeeConfig>) })
      : DEFAULT_FEE_CONFIG;

  if (!companyId) return base;

  const overrides = await prisma.platformSetting.findUnique({
    where: { key: "merchant_invoice.company_overrides" },
  });
  if (
    overrides?.value &&
    typeof overrides.value === "object" &&
    !Array.isArray(overrides.value) &&
    companyId in (overrides.value as Record<string, unknown>)
  ) {
    const companyOverride = (overrides.value as Record<string, Partial<MerchantInvoiceFeeConfig>>)[
      companyId
    ];
    if (companyOverride) {
      return { ...base, ...companyOverride };
    }
  }

  return base;
}

export function computeMerchantInvoiceFee(
  grossAmount: number,
  config: MerchantInvoiceFeeConfig,
): MerchantInvoiceFeeBreakdown {
  if (!config.enabled || grossAmount <= 0) {
    return {
      grossAmount,
      feeAmount: 0,
      netAmount: grossAmount,
      totalDebited: grossAmount,
    };
  }

  let feeAmount =
    config.type === "flat" ? config.value : (grossAmount * config.value) / 100;

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

export async function quoteMerchantInvoiceFees(
  grossAmount: number,
  companyId: string,
): Promise<MerchantInvoiceFeeBreakdown> {
  const config = await getMerchantInvoiceFeeConfig(companyId);
  return computeMerchantInvoiceFee(grossAmount, config);
}
