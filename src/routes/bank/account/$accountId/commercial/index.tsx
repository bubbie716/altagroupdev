import { createFileRoute, redirect } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { AccountCommercialShell } from "@/components/bank/commercial/account-commercial-shell";
import { CommercialDashboardPanel } from "@/components/bank/commercial/commercial-dashboard-panel";
import { fetchAccountCommercialContext } from "@/lib/bank/account-commercial-loader.functions";
import { fetchCommercialDashboard } from "@/lib/bank/commercial-banking.functions";

export const Route = createFileRoute("/bank/account/$accountId/commercial/")({
  loader: async ({ params }) => {
    try {
      const { context } = await fetchAccountCommercialContext({ data: params.accountId });
      const dashboard = context.isVerified
        ? await fetchCommercialDashboard({ data: context.companyId })
        : null;
      return { context, dashboard };
    } catch {
      throw redirect({
        to: "/bank/account/$accountId/commercial/settings",
        params: { accountId: params.accountId },
      });
    }
  },
  head: () => ({ meta: [{ title: "Alta Commercial — Business Account" }] }),
  component: AccountCommercialDashboardPage,
});

function AccountCommercialDashboardPage() {
  const { accountId } = Route.useParams();
  const { context, dashboard } = Route.useLoaderData();

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
      </div>
    </AccountCommercialShell>
  );
}
