import type { AltaUser } from "@/lib/auth/types";
import type { PayFundingSourceOption } from "@/lib/bank/alta-pay-types";
import type { PaymentEngineFundingSource } from "@/lib/bank/payment-engine-funding-types";
import { listPayFundingSources, resolvePayFundingSourceOption } from "@/server/alta-pay.service";

const ALTA_PAY_SELF_COMPANY_MESSAGE = "Companies cannot send Alta Pay to themselves.";

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

export function assertAltaPayRecipientNotSameCompany(
  recipientCompanyId: string,
  fundingSource: PaymentEngineFundingSource,
  allowed: { companyId?: string | null; employerCompanyId?: string },
): void {
  if (
    fundingSource.kind === "bank_account" &&
    allowed.companyId &&
    allowed.companyId === recipientCompanyId
  ) {
    badRequest(ALTA_PAY_SELF_COMPANY_MESSAGE);
  }
  if (
    fundingSource.kind === "alta_card" &&
    allowed.employerCompanyId === recipientCompanyId
  ) {
    badRequest(ALTA_PAY_SELF_COMPANY_MESSAGE);
  }
}

export function paymentEngineFundingSourceKey(source: PaymentEngineFundingSource): string {
  return source.kind === "bank_account"
    ? `bank_account:${source.accountId}`
    : `alta_card:${source.cardId}`;
}

export function parsePaymentEngineFundingSource(
  raw: unknown,
  fallbackBankAccountId?: string | null,
): PaymentEngineFundingSource | null {
  if (raw && typeof raw === "object" && "kind" in raw) {
    const value = raw as PaymentEngineFundingSource;
    if (value.kind === "bank_account" && value.accountId) {
      return { kind: "bank_account", accountId: value.accountId };
    }
    if (value.kind === "alta_card" && value.cardId) {
      return { kind: "alta_card", cardId: value.cardId };
    }
  }
  if (fallbackBankAccountId) {
    return { kind: "bank_account", accountId: fallbackBankAccountId };
  }
  return null;
}

export async function assertPaymentEngineFundingSource(
  user: AltaUser,
  source: PaymentEngineFundingSource,
  options?: {
    merchantCompanyId?: string;
    requireCompanyPayee?: boolean;
  },
): Promise<PayFundingSourceOption> {
  const allowed = resolvePayFundingSourceOption(await listPayFundingSources(user), source);

  if (options?.merchantCompanyId) {
    assertAltaPayRecipientNotSameCompany(options.merchantCompanyId, source, allowed);
  }

  if (source.kind === "alta_card") {
    if (options?.requireCompanyPayee) {
      badRequest("Alta Card funding is only available for merchant and company payees.");
    }
  }

  return allowed;
}

export function paymentEngineFundingLabel(
  source: PaymentEngineFundingSource,
  option?: PayFundingSourceOption | null,
): string {
  if (option) return option.label;
  return source.kind === "bank_account" ? "Alta Bank account" : "Alta Card";
}
