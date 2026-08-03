import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BusinessAccountPaymentsCenter } from "@/components/bank/business-account-payments-center";
import { AltaPayReceivedPanel } from "@/components/bank/alta-pay-received-panel";
import { RoutePendingFallback } from "@/components/ui/route-pending-fallback";
import { fetchBusinessAccountContextForModule } from "@/lib/bank/business-account.functions";
import { fetchScheduledPayments } from "@/lib/bank/business-banking.functions";
import { fetchCompanyAltaPayReceived } from "@/lib/bank/alta-pay.functions";
import { fetchTransferContacts } from "@/lib/bank/bank.functions";
import { refreshMutationRouteData } from "@/lib/router/post-mutation-refresh";

export const Route = createFileRoute("/bank/account/$accountId/commercial/payments")({
  loader: async ({ params }) => {
    try {
      const ctx = await fetchBusinessAccountContextForModule({
        data: { accountId: params.accountId, module: "payments" },
      });
      const [payments, contacts, altaPayReceived] = await Promise.all([
        fetchScheduledPayments({ data: ctx.companyId }),
        fetchTransferContacts({ data: "intrabank" }).catch(() => []),
        fetchCompanyAltaPayReceived({ data: ctx.companyId }).catch(() => null),
      ]);
      return {
        treasury: ctx.treasury,
        payments,
        contacts,
        altaPayReceived,
      };
    } catch {
      throw redirect({
        to: "/bank/account/$accountId",
        params: { accountId: params.accountId },
      });
    }
  },
  head: () => ({ meta: [{ title: "Payments — Alta Commercial" }] }),
  pendingComponent: () => <RoutePendingFallback label="Loading payments" />,
  component: AccountCommercialPaymentsPage,
});

function AccountCommercialPaymentsPage() {
  const { treasury, payments, contacts, altaPayReceived } = Route.useLoaderData();
  const router = useRouter();

  return (
    <div className="space-y-8">
      <Section title="Payments">
        <BusinessAccountPaymentsCenter
          company={treasury}
          payments={payments}
          contacts={contacts}
          onChanged={() => refreshMutationRouteData(router, "corporate")}
        />
      </Section>
      {altaPayReceived ? (
        <Section title="Alta Pay received">
          <AltaPayReceivedPanel summary={altaPayReceived} />
        </Section>
      ) : null}
    </div>
  );
}
