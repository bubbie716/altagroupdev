import { createFileRoute, redirect } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { MerchantInvoiceCreatePanel } from "@/components/bank/merchant-invoices/merchant-invoice-create-panel";
import { fetchAccountCommercialContext } from "@/lib/bank/account-commercial-loader.functions";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { fetchCommercialReceivableCreationLimits } from "@/lib/bank/commercial-banking.functions";
import { fetchRecurringInvoiceSchedules } from "@/lib/bank/payments-engine.functions";
import { isCommercialProActive } from "@/lib/bank/commercial-banking-types";

export const Route = createFileRoute("/bank/account/$accountId/commercial/invoices/new")({
  loader: async ({ params }) => {
    const { context } = await fetchAccountCommercialContext({ data: params.accountId });
    const canUseRecurringInvoices = isCommercialProActive(context.plan);
    const limits = await fetchCommercialReceivableCreationLimits({ data: context.companyId });
    if (!limits.canCreateInvoice) {
      throw redirect({
        to: accountCommercialRoutes.invoices,
        params: { accountId: params.accountId },
      });
    }
    const recurringSchedules = canUseRecurringInvoices
      ? await fetchRecurringInvoiceSchedules({ data: context.companyId })
      : [];
    return { companyId: context.companyId, canUseRecurringInvoices, recurringSchedules };
  },
  head: () => ({ meta: [{ title: "New Invoice — Business Account" }] }),
  component: AccountCommercialNewInvoicePage,
});

function AccountCommercialNewInvoicePage() {
  const { accountId } = Route.useParams();
  const { companyId, canUseRecurringInvoices, recurringSchedules } = Route.useLoaderData();

  return (
    <Section title="Create invoice">
      <MerchantInvoiceCreatePanel
        companyId={companyId}
        accountId={accountId}
        canUseRecurringInvoices={canUseRecurringInvoices}
        recurringSchedules={recurringSchedules}
      />
    </Section>
  );
}
