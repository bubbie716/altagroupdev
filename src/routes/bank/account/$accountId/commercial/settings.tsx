import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { AccountCommercialShell } from "@/components/bank/commercial/account-commercial-shell";
import { CommercialSettingsPanel } from "@/components/bank/commercial/commercial-settings-panel";
import { loadAccountCommercialContext } from "@/lib/bank/account-commercial-loader";
import { fetchCommercialSettings } from "@/lib/bank/commercial-banking.functions";
import { Route as CommercialRoute } from "./route";

export const Route = createFileRoute("/bank/account/$accountId/commercial/settings")({
  loader: async ({ params }) => {
    const { context } = await loadAccountCommercialContext(params.accountId);
    const settings = await fetchCommercialSettings({ data: context.companyId });
    return { settings };
  },
  head: () => ({ meta: [{ title: "Commercial Settings — Business Account" }] }),
  component: AccountCommercialSettingsPage,
});

function AccountCommercialSettingsPage() {
  const { context } = CommercialRoute.useLoaderData();
  const { settings } = Route.useLoaderData();
  const router = useRouter();

  return (
    <AccountCommercialShell context={context}>
      <Section title="Plan & billing">
        <CommercialSettingsPanel
          settings={settings}
          accountId={params.accountId}
          onUpdated={() => {
            void router.invalidate();
          }}
        />
      </Section>
    </AccountCommercialShell>
  );
}
