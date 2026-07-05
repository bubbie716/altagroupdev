import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Card, Section } from "@/components/page-shell";
import { AccountCommercialShell } from "@/components/bank/commercial/account-commercial-shell";
import { BasicMerchantAnalyticsPanel } from "@/components/bank/commercial/basic-merchant-analytics-panel";
import { MerchantAnalyticsPanel } from "@/components/bank/commercial/merchant-analytics-panel";
import { fetchAccountCommercialContext } from "@/lib/bank/account-commercial-loader.functions";
import {
  fetchBasicMerchantAnalytics,
  fetchMerchantAnalytics,
} from "@/lib/bank/commercial-banking.functions";
import type { MerchantAnalyticsRange } from "@/lib/bank/commercial-banking-types";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { Route as CommercialRoute } from "./route";

const VALID_RANGES = new Set<MerchantAnalyticsRange>(["7D", "30D", "90D", "YTD", "ALL"]);

export const Route = createFileRoute("/bank/account/$accountId/commercial/analytics")({
  validateSearch: (search: Record<string, unknown>) => ({
    range:
      typeof search.range === "string" && VALID_RANGES.has(search.range as MerchantAnalyticsRange)
        ? (search.range as MerchantAnalyticsRange)
        : ("30D" as MerchantAnalyticsRange),
  }),
  loader: async ({ params, deps }) => {
    const { context } = await fetchAccountCommercialContext({ data: params.accountId });
    const range = deps.range;
    const isAdvanced =
      context.plan.commercialPlan === "PRO" &&
      context.plan.planStatus === "ACTIVE" &&
      context.plan.enabledFeatures.includes("merchant_analytics");

    let analytics = null;
    let basicAnalytics = null;
    if (context.isVerified && context.canViewAnalytics) {
      if (isAdvanced) {
        analytics = await fetchMerchantAnalytics({
          data: { companyId: context.companyId, range },
        });
      } else {
        basicAnalytics = await fetchBasicMerchantAnalytics({ data: context.companyId });
      }
    }

    return { analytics, basicAnalytics, isAdvanced, range };
  },
  loaderDeps: ({ search }) => ({ range: search.range }),
  head: () => ({ meta: [{ title: "Merchant Analytics — Business Account" }] }),
  component: AccountCommercialAnalyticsPage,
});

function AccountCommercialAnalyticsPage() {
  const { accountId } = Route.useParams();
  const { context } = CommercialRoute.useLoaderData();
  const { analytics, basicAnalytics, isAdvanced } = Route.useLoaderData();
  const router = useRouter();

  return (
    <AccountCommercialShell context={context}>
      {context.isVerified && !context.canViewAnalytics ? (
        <Section title="Receivables analytics">
          <Card className="!p-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Alta Commercial
            </p>
            <h2 className="mt-3 text-xl font-medium tracking-tight">Merchant analytics</h2>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Analytics are available once your company is verified and you have commercial access.
            </p>
          </Card>
        </Section>
      ) : basicAnalytics && !isAdvanced ? (
        <Section title="Receivables analytics">
          <BasicMerchantAnalyticsPanel analytics={basicAnalytics} accountId={accountId} />
        </Section>
      ) : analytics ? (
        <Section title="Receivables analytics">
          <MerchantAnalyticsPanel
            analytics={analytics}
            onRangeChange={(nextRange) => {
              void router.navigate({
                to: accountCommercialRoutes.analytics,
                params: { accountId },
                search: { range: nextRange },
                resetScroll: false,
              });
            }}
          />
        </Section>
      ) : (
        <Section title="Receivables analytics">
          <Card className="!p-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Alta Commercial Pro
            </p>
            <h2 className="mt-3 text-xl font-medium tracking-tight">Advanced analytics</h2>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Payment trends, top customers, success rates, and longer history are available on Alta
              Commercial Pro.
            </p>
            <Link
              to={accountCommercialRoutes.settings}
              params={{ accountId }}
              className="mt-6 inline-flex items-center rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Upgrade to Pro
            </Link>
          </Card>
        </Section>
      )}
    </AccountCommercialShell>
  );
}
