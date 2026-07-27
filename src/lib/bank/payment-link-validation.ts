/**
 * Shared client/server validation for payment link create/edit.
 * Messages are customer-facing (no BAD_REQUEST: prefix).
 */

export type PaymentLinkAmountType = "FIXED" | "OPEN";
export type PaymentLinkUsageType = "ONE_TIME" | "REUSABLE";

export type PaymentLinkFormValues = {
  title: string;
  description: string;
  internalMemo: string;
  amountType: PaymentLinkAmountType;
  usageType: PaymentLinkUsageType;
  amount: string;
  minAmount: string;
  maxAmount: string;
  expiresAt: string;
};

export function parseOptionalAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return Number.NaN;
  return value;
}

/** Returns a customer-facing error when min/max are invalid; otherwise null. */
export function validatePaymentLinkMinMax(
  minAmount: number | null | undefined,
  maxAmount: number | null | undefined,
): string | null {
  const min = minAmount ?? null;
  const max = maxAmount ?? null;
  if (min != null && (!Number.isFinite(min) || min <= 0)) {
    return "Minimum amount must be greater than zero.";
  }
  if (max != null && (!Number.isFinite(max) || max <= 0)) {
    return "Maximum amount must be greater than zero.";
  }
  if (min != null && max != null && min > max) {
    return "Minimum amount cannot exceed maximum amount.";
  }
  return null;
}

/**
 * Rejects invalid dates and expirations that are already in the past.
 * Empty / null expiration is allowed (no expiry).
 */
export function validatePaymentLinkExpiration(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (expiresAt == null || !String(expiresAt).trim()) return null;
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return "Enter a valid expiration date.";
  }
  if (parsed.getTime() <= now.getTime()) {
    return "Expiration must be in the future.";
  }
  return null;
}

export function validatePaymentLinkDetails(values: Pick<PaymentLinkFormValues, "description">): string | null {
  if (!values.description.trim()) return "Description is required.";
  return null;
}

export function validatePaymentLinkAmountRules(
  values: Pick<
    PaymentLinkFormValues,
    "amountType" | "amount" | "minAmount" | "maxAmount" | "expiresAt"
  >,
  now: Date = new Date(),
): string | null {
  if (values.amountType === "FIXED") {
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return "Enter a fixed amount greater than zero.";
    }
  } else {
    const min = parseOptionalAmount(values.minAmount);
    const max = parseOptionalAmount(values.maxAmount);
    if (Number.isNaN(min) || Number.isNaN(max)) {
      return "Enter valid minimum and maximum amounts.";
    }
    const minMaxError = validatePaymentLinkMinMax(min, max);
    if (minMaxError) return minMaxError;
  }
  return validatePaymentLinkExpiration(values.expiresAt || null, now);
}

export function isPaymentLinkFormDirty(
  values: PaymentLinkFormValues,
  initial: PaymentLinkFormValues,
): boolean {
  return (
    values.title !== initial.title ||
    values.description !== initial.description ||
    values.internalMemo !== initial.internalMemo ||
    values.amountType !== initial.amountType ||
    values.usageType !== initial.usageType ||
    values.amount !== initial.amount ||
    values.minAmount !== initial.minAmount ||
    values.maxAmount !== initial.maxAmount ||
    values.expiresAt !== initial.expiresAt
  );
}

export const EMPTY_PAYMENT_LINK_FORM: PaymentLinkFormValues = {
  title: "",
  description: "",
  internalMemo: "",
  amountType: "FIXED",
  usageType: "REUSABLE",
  amount: "",
  minAmount: "",
  maxAmount: "",
  expiresAt: "",
};
