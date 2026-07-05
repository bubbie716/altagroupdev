import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { AccountCommercialShell } from "@/components/bank/commercial/account-commercial-shell";
import { PaymentLinkDashboardPanel } from "@/components/bank/payment-links/payment-link-dashboard";
import { fetchAccountCommercialContext } from "@/lib/bank/account-commercial-loader.functions";
import { fetchCommercialReceivableCreationLimits } from "@/lib/bank/commercial-banking.functions";
import { fetchPaymentLinkDashboard } from "@/lib/bank/payment-link.functions";
import { Route as CommercialRoute } from "../route";

export const Route = createFileRoute("/bank/account/$accountId/commercial/payment-links/")({
  loader: async ({ params }) => {
    const { context } = await fetchAccountCommercialContext({ data: params.accountId });
    if (!context.isVerified) {
      return { dashboard: null, canCreate: true, createLimitMessage: undefined };
    }

    const [dashboard, limits] = await Promise.all([
      fetchPaymentLinkDashboard({ data: context.companyId }),
      fetchCommercialReceivableCreationLimits({ data: context.companyId }),
    ]);

    return {
      dashboard,
      canCreate: limits.canCreatePaymentLink,
      createLimitMessage: limits.paymentLinkLimitMessage,
    };
  },
  head: () => ({ meta: [{ title: "Payment Links — Business Account" }] }),
  component: AccountCommercialPaymentLinksPage,
});

function AccountCommercialPaymentLinksPage() {
  const { accountId } = Route.useParams();
  const { context } = CommercialRoute.useLoaderData();
  const { dashboard, canCreate, createLimitMessage } = Route.useLoaderData();

  return (
    <AccountCommercialShell context={context}>
      {dashboard ? (
        <Section title="Payment link dashboard">
          <PaymentLinkDashboardPanel
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
