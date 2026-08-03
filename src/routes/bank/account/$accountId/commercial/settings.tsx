import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { AccountCommercialShell } from "@/components/bank/commercial/account-commercial-shell";
import { CommercialSettingsPanel } from "@/components/bank/commercial/commercial-settings-panel";
import { requireCommercialFromRouteContext } from "@/lib/bank/account-commercial-loader.functions";
import { fetchCommercialSettings } from "@/lib/bank/commercial-banking.functions";
import { Route as CommercialRoute } from "./route";
import { refreshMutationRouteData } from "@/lib/router/post-mutation-refresh";

export const Route = createFileRoute("/bank/account/$accountId/commercial/settings")({
  loader: async ({ context }) => {
    const commercial = requireCommercialFromRouteContext(context);
    const settings = await fetchCommercialSettings({ data: commercial.companyId });
    return { settings };
  },
  head: () => ({ meta: [{ title: "Commercial Settings — Business Account" }] }),
  component: AccountCommercialSettingsPage,
});

function AccountCommercialSettingsPage() {
  const { accountId } = Route.useParams();
  const { context } = CommercialRoute.useLoaderData();
  const { settings } = Route.useLoaderData();
  const router = useRouter();

  if (!context) return null;

  return (
    <AccountCommercialShell context={context}>
      <Section title="Plan & billing">
        <CommercialSettingsPanel
          settings={settings}
          accountId={accountId}
          onUpdated={() => {
            void refreshMutationRouteData(router, "corporate");
          }}
        />
      </Section>
    </AccountCommercialShell>
  );
}
