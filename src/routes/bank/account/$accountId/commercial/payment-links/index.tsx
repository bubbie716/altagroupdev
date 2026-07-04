import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { AccountCommercialShell } from "@/components/bank/commercial/account-commercial-shell";
import { PaymentLinkDashboardPanel } from "@/components/bank/payment-links/payment-link-dashboard";
import { loadAccountCommercialContext } from "@/lib/bank/account-commercial-loader";
import { fetchPaymentLinkDashboard } from "@/lib/bank/payment-link.functions";
import { Route as CommercialRoute } from "../route";

export const Route = createFileRoute("/bank/account/$accountId/commercial/payment-links/")({
  loader: async ({ params }) => {
    const { context } = await loadAccountCommercialContext(params.accountId);
    const dashboard = context.isVerified
      ? await fetchPaymentLinkDashboard({ data: context.companyId })
      : null;
    return { dashboard };
  },
  head: () => ({ meta: [{ title: "Payment Links — Business Account" }] }),
  component: AccountCommercialPaymentLinksPage,
});

function AccountCommercialPaymentLinksPage() {
  const { accountId } = Route.useParams();
  const { context } = CommercialRoute.useLoaderData();
  const { dashboard } = Route.useLoaderData();

  return (
    <AccountCommercialShell context={context}>
      {dashboard ? (
        <Section title="Payment link dashboard">
          <PaymentLinkDashboardPanel
            dashboard={dashboard}
            companyId={context.companyId}
            accountId={accountId}
          />
        </Section>
      ) : null}
    </AccountCommercialShell>
  );
}
