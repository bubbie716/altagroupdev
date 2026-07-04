import { createFileRoute, redirect } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { Section } from "@/components/page-shell";
import { PaymentLinkDashboardPanel } from "@/components/bank/payment-links/payment-link-dashboard";
import { CommercialAccountBackLink } from "@/components/bank/commercial-account-back-link";
import { fetchPaymentLinkDashboard } from "@/lib/bank/payment-link.functions";
import { resolveBusinessOperatingAccountRedirect } from "@/lib/bank/business-account.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/commercial/payment-links/")({
  beforeLoad: authBeforeLoad,
  loader: async ({ location }) => {
    const companyId = new URLSearchParams(location.searchStr).get("companyId") ?? undefined;
    const resolved = await resolveBusinessOperatingAccountRedirect({ data: companyId ?? undefined });
    if (!resolved) {
      throw redirect({ to: "/bank/business" });
    }
    const activeCompanyId = companyId ?? resolved.companyId;
    const dashboard = await fetchPaymentLinkDashboard({ data: activeCompanyId });
    return { dashboard, companyId: activeCompanyId, accountId: resolved.accountId };
  },
  head: () => ({ meta: [{ title: "Payment Links — Alta Bank" }] }),
  component: PaymentLinksPage,
});

function PaymentLinksPage() {
  const { dashboard, companyId, accountId } = Route.useLoaderData();

  return (
    <>
      <BankPageMeta eyebrow="Commercial Banking" title="Payment Links" />
      <CommercialAccountBackLink accountId={accountId} />
      <Section title="Payment link dashboard">
        <PaymentLinkDashboardPanel
          dashboard={dashboard}
          companyId={companyId}
          accountId={accountId}
        />
      </Section>
    </>
  );
}
