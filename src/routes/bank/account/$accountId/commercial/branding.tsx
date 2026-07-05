import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Section } from "@/components/page-shell";
import { AccountCommercialShell } from "@/components/bank/commercial/account-commercial-shell";
import { CommercialBrandingPanel } from "@/components/bank/commercial/commercial-branding-panel";
import { fetchAccountCommercialContext } from "@/lib/bank/account-commercial-loader.functions";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { canPublishInvoiceBranding } from "@/lib/bank/commercial-banking-types";
import { fetchCompanyBrandingSettings } from "@/lib/bank/company-branding.functions";

export const Route = createFileRoute("/bank/account/$accountId/commercial/branding")({
  loader: async ({ params }) => {
    const { context } = await fetchAccountCommercialContext({ data: params.accountId });
    if (!canPublishInvoiceBranding(context.plan)) {
      throw redirect({
        to: accountCommercialRoutes.settings,
        params: { accountId: params.accountId },
      });
    }
    const branding = await fetchCompanyBrandingSettings({ data: context.companyId });
    return { context, branding };
  },
  head: () => ({ meta: [{ title: "Branding — Commercial Settings" }] }),
  component: CommercialBrandingSettingsPage,
});

function CommercialBrandingSettingsPage() {
  const { accountId } = Route.useParams();
  const { context, branding } = Route.useLoaderData();
  const router = useRouter();

  return (
    <AccountCommercialShell context={context}>
      <Link
        to={accountCommercialRoutes.settings}
        params={{ accountId }}
        className="-ml-1 mb-4 inline-flex items-center gap-1.5 rounded-md px-1 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Back to plan & billing
      </Link>
      <Section title="Invoice & payment link branding">
        <CommercialBrandingPanel
          settings={branding}
          accountId={accountId}
          onUpdated={() => {
            void router.invalidate();
          }}
        />
      </Section>
    </AccountCommercialShell>
  );
}
