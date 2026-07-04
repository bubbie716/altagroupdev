import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { MerchantInvoiceDashboardPanel } from "@/components/bank/merchant-invoices/merchant-invoice-dashboard";
import { fetchMerchantInvoiceDashboard } from "@/lib/bank/merchant-invoice.functions";
import { fetchBusinessAccountContextForModule } from "@/lib/bank/business-account.functions";
import { canManageMerchantInvoices } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/bank/account/$accountId/invoices")({
  loader: async ({ params }) => {
    const ctx = await fetchBusinessAccountContextForModule({
      data: { accountId: params.accountId, module: "invoices" },
    });
    const dashboard = await fetchMerchantInvoiceDashboard({ data: ctx.companyId });
    return { dashboard, companyId: ctx.companyId };
  },
  head: () => ({ meta: [{ title: "Invoices — Business Account" }] }),
  component: BusinessAccountInvoicesPage,
});

function BusinessAccountInvoicesPage() {
  const { businessContext } = AccountRoute.useLoaderData();
  const { dashboard, companyId } = Route.useLoaderData();
  const user = useCurrentUser();

  if (!businessContext) {
    return <p className="text-[13px] text-muted-foreground">Business account access required.</p>;
  }

  const canCreate =
    user !== null && canManageMerchantInvoices(user, { companyId: businessContext.companyId });

  return (
    <Section title="Merchant invoices">
      <MerchantInvoiceDashboardPanel
        dashboard={dashboard}
        companyId={companyId}
        canCreate={canCreate}
      />
    </Section>
  );
}
