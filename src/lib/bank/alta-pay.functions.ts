import { createServerFn } from "@tanstack/react-start";
import type { SubmitAltaPayInput } from "@/lib/bank/alta-pay-types";

export const fetchPaySourceAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuth } = await import("@/server/auth.service");
  const { listPaySourceAccounts } = await import("@/server/alta-pay.service");
  return listPaySourceAccounts(await requireAuth());
});

/** @deprecated Use fetchPaySourceAccounts */
export const fetchPersonalPaySourceAccounts = fetchPaySourceAccounts;

export const searchPayableCompaniesForPay = createServerFn({ method: "GET" })
  .inputValidator((query: string) => query)
  .handler(async ({ data: query }) => {
    const { searchPayableCompanies } = await import("@/server/alta-pay.service");
    return searchPayableCompanies(query);
  });

export const submitAltaPay = createServerFn({ method: "POST" })
  .inputValidator((input: SubmitAltaPayInput) => input)
  .handler(async ({ data }) => {
    const { submitAltaPayPayment } = await import("@/server/alta-pay.service");
    const { requireAuth } = await import("@/server/auth.service");
    return submitAltaPayPayment(await requireAuth(), data);
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
