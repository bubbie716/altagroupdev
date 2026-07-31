import { createServerFn } from "@tanstack/react-start";
import type { SubmitAltaPayInput, SubmitAltaPayToPersonInput } from "@/lib/bank/alta-pay-types";

export const fetchPayFundingSources = createServerFn({ method: "GET" }).handler(async () => {
  const { isUiLabMode } = await import("@/lib/auth/ui-lab");
  if (isUiLabMode()) {
    const { getUiLabPayFundingSources } = await import("@/lib/bank/ui-lab-commercial-fixtures");
    return getUiLabPayFundingSources();
  }
  const { requireAuth } = await import("@/server/auth.service");
  const { listPayFundingSources } = await import("@/server/alta-pay.service");
  return listPayFundingSources(await requireAuth());
});

export const fetchPaySourceAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const { isUiLabMode } = await import("@/lib/auth/ui-lab");
  if (isUiLabMode()) {
    const { getUiLabPayFundingSources } = await import("@/lib/bank/ui-lab-commercial-fixtures");
    return getUiLabPayFundingSources()
      .filter((s) => s.kind === "bank_account")
      .map((s) => ({
        id: s.id,
        accountName: s.label,
        accountNumber: s.detail,
        balance: s.availableBalance,
        availableBalance: s.availableBalance,
        companyId: s.companyId ?? null,
        companyName: null,
        isCompanyAccount: Boolean(s.companyId),
        accountStatusInfo: s.accountStatusInfo,
      }));
  }
  const { requireAuth } = await import("@/server/auth.service");
  const { listPaySourceAccounts } = await import("@/server/alta-pay.service");
  return listPaySourceAccounts(await requireAuth());
});

/** @deprecated Use fetchPaySourceAccounts */
export const fetchPersonalPaySourceAccounts = fetchPaySourceAccounts;

export const searchPayableCompaniesForPay = createServerFn({ method: "GET" })
  .inputValidator((query: string) => query)
  .handler(async ({ data: query }) => {
    const { requireAuth } = await import("@/server/auth.service");
    await requireAuth();
    const { searchPayableCompanies } = await import("@/server/alta-pay.service");
    return searchPayableCompanies(query);
  });

export const searchPayableRecipientsForPay = createServerFn({ method: "GET" })
  .inputValidator((query: string) => query)
  .handler(async ({ data: query }) => {
    const { searchPayableRecipients } = await import("@/server/alta-pay.service");
    const { requireAuth } = await import("@/server/auth.service");
    const user = await requireAuth();
    return searchPayableRecipients(user.id, query);
  });

export const submitAltaPay = createServerFn({ method: "POST" })
  .inputValidator((input: SubmitAltaPayInput) => input)
  .handler(async ({ data }) => {
    const { submitAltaPayPayment } = await import("@/server/alta-pay.service");
    const { requireAuth } = await import("@/server/auth.service");
    const { assertUserRateLimit } = await import("@/server/rate-limit.service");
    const user = await requireAuth();
    const { assertProductConsentForAction } = await import("@/server/product-consent-guard");
    await assertProductConsentForAction(user, "alta_pay.submit");
    assertUserRateLimit(user.id, "alta-pay", 30, 60_000);
    try {
      return await submitAltaPayPayment(user, data);
    } catch (error) {
      const { notifyAltaPayFailedBestEffort, friendlyFailureReason } = await import(
        "@/server/banking-notification.service"
      );
      await notifyAltaPayFailedBestEffort(user.id, {
        amount: data.amount,
        reason: friendlyFailureReason(error),
        payeeLabel: data.companyId,
      });
      throw error;
    }
  });

export const submitAltaPayToPersonPayment = createServerFn({ method: "POST" })
  .inputValidator((input: SubmitAltaPayToPersonInput) => input)
  .handler(async ({ data }) => {
    const { submitAltaPayToPerson } = await import("@/server/alta-pay.service");
    const { requireAuth } = await import("@/server/auth.service");
    const { assertUserRateLimit } = await import("@/server/rate-limit.service");
    const user = await requireAuth();
    const { assertProductConsentForAction } = await import("@/server/product-consent-guard");
    await assertProductConsentForAction(user, "alta_pay.submit");
    assertUserRateLimit(user.id, "alta-pay", 30, 60_000);
    try {
      return await submitAltaPayToPerson(user, data);
    } catch (error) {
      const { notifyAltaPayFailedBestEffort, friendlyFailureReason } = await import(
        "@/server/banking-notification.service"
      );
      await notifyAltaPayFailedBestEffort(user.id, {
        amount: data.amount,
        reason: friendlyFailureReason(error),
        payeeLabel: data.recipientUserId,
      });
      throw error;
    }
  });

export const fetchUserAltaPayHistory = createServerFn({ method: "GET" })
  .inputValidator((limit: number | undefined) => limit ?? 25)
  .handler(async ({ data: limit }) => {
    const { listUserAltaPaySent } = await import("@/server/alta-pay.service");
    const { requireAuth } = await import("@/server/auth.service");
    return listUserAltaPaySent(await requireAuth(), limit);
  });

export const fetchCompanyAltaPayReceived = createServerFn({ method: "GET" })
  .inputValidator((companyId: string) => companyId)
  .handler(async ({ data: companyId }) => {
    const { listCompanyAltaPayReceived } = await import("@/server/alta-pay.service");
    const { requireAuth } = await import("@/server/auth.service");
    const user = await requireAuth();
    return listCompanyAltaPayReceived(user, companyId);
  });

export const fetchAltaPayVolume = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  await requireOperator();
  const { getAltaPayVolumeSummary } = await import("@/server/alta-pay.service");
  return getAltaPayVolumeSummary();
});
