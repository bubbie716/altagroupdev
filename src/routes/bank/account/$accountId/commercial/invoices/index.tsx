import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { AccountCommercialShell } from "@/components/bank/commercial/account-commercial-shell";
import { MerchantInvoiceDashboardPanel } from "@/components/bank/merchant-invoices/merchant-invoice-dashboard";
import { loadAccountCommercialContext } from "@/lib/bank/account-commercial-loader";
import { fetchMerchantInvoiceDashboard } from "@/lib/bank/merchant-invoice.functions";
import { Route as CommercialRoute } from "../route";

export const Route = createFileRoute("/bank/account/$accountId/commercial/invoices/")({
  loader: async ({ params }) => {
    const { context } = await loadAccountCommercialContext(params.accountId);
    const dashboard = context.isVerified
      ? await fetchMerchantInvoiceDashboard({ data: context.companyId })
      : null;
    return { dashboard };
  },
  head: () => ({ meta: [{ title: "Merchant Invoices — Business Account" }] }),
  component: AccountCommercialInvoicesPage,
});

function AccountCommercialInvoicesPage() {
  const { accountId } = Route.useParams();
  const { context } = CommercialRoute.useLoaderData();
  const { dashboard } = Route.useLoaderData();

  return (
    <AccountCommercialShell context={context}>
      {dashboard ? (
        <Section title="Invoice dashboard">
          <MerchantInvoiceDashboardPanel
            dashboard={dashboard}
            companyId={context.companyId}
            accountId={accountId}
          />
        </Section>
      ) : null}
    </AccountCommercialShell>
  );
}
