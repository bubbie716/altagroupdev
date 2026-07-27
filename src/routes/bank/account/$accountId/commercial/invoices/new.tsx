import { createFileRoute, redirect } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { MerchantInvoiceCreatePanel } from "@/components/bank/merchant-invoices/merchant-invoice-create-panel";
import { requireCommercialFromRouteContext } from "@/lib/bank/account-commercial-loader.functions";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { fetchCommercialReceivableCreationLimits } from "@/lib/bank/commercial-banking.functions";
import { fetchRecurringInvoiceSchedules } from "@/lib/bank/payments-engine.functions";
import { isCommercialProActive } from "@/lib/bank/commercial-banking-types";

/**
 * Thin wrapper: Core plans redirect to the invoice list modal (`?create=1`).
 * Pro keeps this page for one-time vs recurring mode selection.
 */
export const Route = createFileRoute("/bank/account/$accountId/commercial/invoices/new")({
  loader: async ({ context, params }) => {
    const commercial = requireCommercialFromRouteContext(context);
    const canUseRecurringInvoices = isCommercialProActive(commercial.plan);
    const limits = await fetchCommercialReceivableCreationLimits({ data: commercial.companyId });
    if (!limits.canCreateInvoice) {
      throw redirect({
        to: accountCommercialRoutes.invoices,
        params: { accountId: params.accountId },
      });
    }
    if (!canUseRecurringInvoices) {
      throw redirect({
        to: accountCommercialRoutes.invoices,
        params: { accountId: params.accountId },
        search: { create: 1 },
      });
    }
    const recurringSchedules = await fetchRecurringInvoiceSchedules({
      data: commercial.companyId,
    });
    return { companyId: commercial.companyId, canUseRecurringInvoices, recurringSchedules };
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
