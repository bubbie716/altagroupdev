import { createFileRoute } from "@tanstack/react-router";
import { EntityLoginPage } from "@/components/site/entity-login-page";
import { getSiteConfig } from "@/config/sites";
import { siteFromRouteContext } from "@/lib/site/site-context";

type HomeSearch = {
  redirect?: string;
  error?: string;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  loader: ({ context }) => ({
    siteKey: siteFromRouteContext(context).key,
  }),
  head: ({ loaderData }) => {
    const site = getSiteConfig(loaderData?.siteKey ?? "corporate");

    return {
      meta: [
        { title: `Sign In — ${site.seo.title}` },
        { name: "description", content: site.seo.description },
        {
          property: "og:title",
          content: `Sign In — ${site.seo.ogTitle ?? site.seo.title}`,
        },
        { property: "og:description", content: site.seo.ogDescription ?? site.seo.description },
      ],
    };
  },
  component: HomePage,
});

function HomePage() {
  const { redirect: redirectTo, error } = Route.useSearch();
  return <EntityLoginPage redirect={redirectTo} error={error} />;
}
