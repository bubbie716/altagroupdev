import { createFileRoute } from "@tanstack/react-router";
import { EntityHomeRouter } from "@/components/site/entity-home-router";
import { getSiteConfig } from "@/config/sites";
import { fetchPlatformMetrics } from "@/lib/metrics/platform-metrics.functions";

export const Route = createFileRoute("/home")({
  loader: async () => {
    const platformMetrics = await fetchPlatformMetrics();
    return { platformMetrics };
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
  const { platformMetrics } = Route.useLoaderData();

  return (
    <EntityHomeRouter
      siteKey="corporate"
      corporateProps={{ platformMetrics }}
    />
  );
}
