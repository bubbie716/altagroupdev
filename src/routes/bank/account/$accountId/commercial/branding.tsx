import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Section } from "@/components/page-shell";
import { AccountCommercialShell } from "@/components/bank/commercial/account-commercial-shell";
import { CommercialBrandingPanel } from "@/components/bank/commercial/commercial-branding-panel";
import { requireCommercialFromRouteContext } from "@/lib/bank/account-commercial-loader.functions";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { fetchCompanyBrandingSettings } from "@/lib/bank/company-branding.functions";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";
import { Route as CommercialRoute } from "./route";

export const Route = createFileRoute("/bank/account/$accountId/commercial/branding")({
  loader: async ({ context }) => {
    const commercial = requireCommercialFromRouteContext(context);
    const branding = await fetchCompanyBrandingSettings({ data: commercial.companyId });
    return { branding };
  },
  head: () => ({ meta: [{ title: "Branding — Commercial Settings" }] }),
  component: CommercialBrandingSettingsPage,
});

function CommercialBrandingSettingsPage() {
  const { accountId } = Route.useParams();
  const { context } = CommercialRoute.useLoaderData();
  const { branding } = Route.useLoaderData();
  const router = useRouter();

  if (!context) return null;

  return (
    <AccountCommercialShell context={context}>
      <Link
        to={accountCommercialRoutes.settings}
        params={{ accountId }}
        className="-ml-1 mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Back to plan & billing
      </Link>
      <Section title="Invoice & payment link branding">
        <CommercialBrandingPanel
          settings={branding}
          accountId={accountId}
          onUpdated={() => {
            void invalidateRouteData(router);
          }}
        />
      </Section>
    </AccountCommercialShell>
  );
}
