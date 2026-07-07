import { createFileRoute } from "@tanstack/react-router";
import { EntityHomeRouter } from "@/components/site/entity-home-router";
import { getSiteConfig } from "@/config/sites";
import { fetchHomePortfolioSnapshot } from "@/lib/account/home-portfolio.functions";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";
import { fetchPlatformMetrics } from "@/lib/metrics/platform-metrics.functions";

export const Route = createFileRoute("/home")({
  loader: async ({ context }) => {
    const [platformMetrics, snapshot] = await Promise.all([
      fetchPlatformMetrics(),
      context.user && !isUserFinancialMockDataEnabled()
        ? fetchHomePortfolioSnapshot().catch(() => null)
        : Promise.resolve(null),
    ]);
    return { platformMetrics, snapshot };
  },
  head: () => {
    const seo = getSiteConfig("corporate").seo;

    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:title", content: seo.ogTitle ?? seo.title },
        { property: "og:description", content: seo.ogDescription ?? seo.description },
      ],
    };
  },
  component: CorporateHomePage,
});

function CorporateHomePage() {
  const { platformMetrics, snapshot } = Route.useLoaderData();

  return (
    <EntityHomeRouter
      siteKey="corporate"
      corporateProps={{ platformMetrics, snapshot }}
    />
  );
}
