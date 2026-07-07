import { createFileRoute } from "@tanstack/react-router";
import { EntityLoginPage } from "@/components/site/entity-login-page";
import { NccHomePage } from "@/components/ncc/ncc-home-page";
import { getSiteConfig } from "@/config/sites";

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
    siteKey: context.site.key,
  }),
  head: ({ loaderData }) => {
    const site = getSiteConfig(loaderData?.siteKey ?? "corporate");
    const isNcc = loaderData?.siteKey === "ncc";

    return {
      meta: [
        { title: isNcc ? site.seo.title : `Sign In — ${site.seo.title}` },
        { name: "description", content: site.seo.description },
        {
          property: "og:title",
          content: isNcc ? site.seo.ogTitle ?? site.seo.title : `Sign In — ${site.seo.ogTitle ?? site.seo.title}`,
        },
        { property: "og:description", content: site.seo.ogDescription ?? site.seo.description },
      ],
    };
  },
  component: HomePage,
});

function HomePage() {
  const { siteKey } = Route.useLoaderData();
  const { redirect: redirectTo, error } = Route.useSearch();

  if (siteKey === "ncc") {
    return <NccHomePage />;
  }

  return <EntityLoginPage redirect={redirectTo} error={error} />;
};
