import { createFileRoute, redirect } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { Section } from "@/components/page-shell";
import { MerchantInvoiceDashboardPanel } from "@/components/bank/merchant-invoices/merchant-invoice-dashboard";
import { fetchMerchantInvoiceDashboard } from "@/lib/bank/merchant-invoice.functions";
import { resolveBusinessOperatingAccountRedirect } from "@/lib/bank/business-account.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/commercial/invoices/")({
  beforeLoad: authBeforeLoad,
  loader: async ({ location }) => {
    const companyId = new URLSearchParams(location.searchStr).get("companyId") ?? undefined;
    const resolved = await resolveBusinessOperatingAccountRedirect({ data: companyId ?? undefined });
    if (!resolved) {
      throw redirect({ to: "/bank/business" });
    }
    const activeCompanyId = companyId ?? resolved.companyId;
    const dashboard = await fetchMerchantInvoiceDashboard({ data: activeCompanyId });
    return { dashboard, companyId: activeCompanyId };
  },
  head: () => ({ meta: [{ title: "Merchant Invoices — Alta Bank" }] }),
  component: MerchantInvoicesPage,
});

function MerchantInvoicesPage() {
  const { dashboard, companyId } = Route.useLoaderData();

  return (
    <>
      <BankPageMeta eyebrow="Commercial Banking" title="Merchant Invoices" />
      <Section title="Invoice dashboard">
        <MerchantInvoiceDashboardPanel dashboard={dashboard} companyId={companyId} />
      </Section>
    </>
  );
}
