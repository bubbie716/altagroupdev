import { createFileRoute, redirect } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { AccountCommercialShell } from "@/components/bank/commercial/account-commercial-shell";
import { CommercialDashboardPanel } from "@/components/bank/commercial/commercial-dashboard-panel";
import { AltaPayReceivedPanel } from "@/components/bank/alta-pay-received-panel";
import { loadAccountCommercialContext } from "@/lib/bank/account-commercial-loader";
import { fetchCommercialDashboard } from "@/lib/bank/commercial-banking.functions";
import { fetchCompanyAltaPayReceived } from "@/lib/bank/alta-pay.functions";
import { canViewAltaPayReceived } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/bank/account/$accountId/commercial/")({
  loader: async ({ params }) => {
    try {
      const { context } = await loadAccountCommercialContext(params.accountId);
      const [dashboard, altaPayReceived] = await Promise.all([
        context.isVerified
          ? fetchCommercialDashboard({ data: context.companyId })
          : Promise.resolve(null),
        fetchCompanyAltaPayReceived({ data: context.companyId }).catch(() => null),
      ]);
      return { context, dashboard, altaPayReceived };
    } catch {
      throw redirect({
        to: "/bank/account/$accountId/commercial/payroll",
        params: { accountId: params.accountId },
      });
    }
  },
  head: () => ({ meta: [{ title: "Alta Commercial — Business Account" }] }),
  component: AccountCommercialDashboardPage,
});

function AccountCommercialDashboardPage() {
  const { accountId } = Route.useParams();
  const { context, dashboard, altaPayReceived } = Route.useLoaderData();
  const user = useCurrentUser();

  const showAltaPayReceived =
    altaPayReceived !== null &&
    user !== null &&
    canViewAltaPayReceived(user, { companyId: context.companyId });

  return (
    <AccountCommercialShell context={context}>
      <div className="space-y-8">
        {dashboard ? (
          <Section title="Treasury overview">
            <CommercialDashboardPanel
              dashboard={dashboard}
              companyId={context.companyId}
              accountId={accountId}
              canManage={context.canManage}
            />
          </Section>
        ) : null}
        {showAltaPayReceived ? (
          <Section title="Customer payments received">
            <AltaPayReceivedPanel summary={altaPayReceived} />
          </Section>
        ) : null}
      </div>
    </AccountCommercialShell>
  );
}
