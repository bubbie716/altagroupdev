import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { AccountCommercialShell } from "@/components/bank/commercial/account-commercial-shell";
import { MerchantInvoiceDashboardPanel } from "@/components/bank/merchant-invoices/merchant-invoice-dashboard";
import { requireCommercialFromRouteContext } from "@/lib/bank/account-commercial-loader.functions";
import { fetchCommercialReceivableCreationLimits } from "@/lib/bank/commercial-banking.functions";
import { fetchMerchantInvoiceDashboard } from "@/lib/bank/merchant-invoice.functions";
import { Route as CommercialRoute } from "../route";

export const Route = createFileRoute("/bank/account/$accountId/commercial/invoices/")({
  loader: async ({ context }) => {
    const commercial = requireCommercialFromRouteContext(context);
    if (!commercial.isVerified) {
      return {
        dashboard: null,
        canCreate: true,
        createLimitMessage: undefined,
      };
    }

    const [dashboard, limits] = await Promise.all([
      fetchMerchantInvoiceDashboard({ data: commercial.companyId }),
      fetchCommercialReceivableCreationLimits({ data: commercial.companyId }),
    ]);

    return {
      dashboard,
      canCreate: limits.canCreateInvoice,
      createLimitMessage: limits.invoiceLimitMessage,
    };
  },
  head: () => ({ meta: [{ title: "Merchant Invoices — Business Account" }] }),
  component: AccountCommercialInvoicesPage,
});

function AccountCommercialInvoicesPage() {
  const { accountId } = Route.useParams();
  const { context } = CommercialRoute.useLoaderData();
  const { dashboard, canCreate, createLimitMessage } = Route.useLoaderData();

  if (!context) return null;

  return (
    <AccountCommercialShell context={context}>
      {dashboard ? (
        <Section title="Invoice dashboard">
          <MerchantInvoiceDashboardPanel
            dashboard={dashboard}
            companyId={context.companyId}
            accountId={accountId}
            canCreate={canCreate}
            createLimitMessage={createLimitMessage}
          />
        </Section>
      ) : null}
    </AccountCommercialShell>
  );
}
