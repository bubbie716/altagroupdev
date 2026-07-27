import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { AccountCommercialShell } from "@/components/bank/commercial/account-commercial-shell";
import { PaymentLinkDashboardPanel } from "@/components/bank/payment-links/payment-link-dashboard";
import { requireCommercialFromRouteContext } from "@/lib/bank/account-commercial-loader.functions";
import { fetchCommercialReceivableCreationLimits } from "@/lib/bank/commercial-banking.functions";
import { fetchPaymentLinkDashboard } from "@/lib/bank/payment-link.functions";
import { Route as CommercialRoute } from "../route";

type PaymentLinksSearch = {
  create?: 1;
};

export const Route = createFileRoute("/bank/account/$accountId/commercial/payment-links/")({
  validateSearch: (search: Record<string, unknown>): PaymentLinksSearch => {
    if (search.create === 1 || search.create === "1") return { create: 1 };
    return {};
  },
  loader: async ({ context }) => {
    const commercial = requireCommercialFromRouteContext(context);
    if (!commercial.isVerified) {
      return {
        dashboard: null,
        canCreate: true,
        createLimitMessage: undefined,
        paymentLinksThisMonth: undefined,
        paymentLinkMonthlyLimit: undefined,
      };
    }

    const [dashboard, limits] = await Promise.all([
      fetchPaymentLinkDashboard({ data: commercial.companyId }),
      fetchCommercialReceivableCreationLimits({ data: commercial.companyId }),
    ]);

    return {
      dashboard,
      canCreate: limits.canCreatePaymentLink,
      createLimitMessage: limits.paymentLinkLimitMessage,
      paymentLinksThisMonth: limits.paymentLinksThisMonth,
      paymentLinkMonthlyLimit: limits.paymentLinkMonthlyLimit,
    };
  },
  head: () => ({ meta: [{ title: "Payment Links — Business Account" }] }),
  component: AccountCommercialPaymentLinksPage,
});

function AccountCommercialPaymentLinksPage() {
  const { accountId } = Route.useParams();
  const { create } = Route.useSearch();
  const { context } = CommercialRoute.useLoaderData();
  const {
    dashboard,
    canCreate,
    createLimitMessage,
    paymentLinksThisMonth,
    paymentLinkMonthlyLimit,
  } = Route.useLoaderData();

  if (!context) return null;

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
            paymentLinksThisMonth={paymentLinksThisMonth}
            paymentLinkMonthlyLimit={paymentLinkMonthlyLimit}
            autoOpenCreate={create === 1}
          />
        </Section>
      ) : null}
    </AccountCommercialShell>
  );
}
