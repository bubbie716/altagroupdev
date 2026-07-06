import { createFileRoute } from "@tanstack/react-router";
import { EntityLoginPage } from "@/components/site/entity-login-page";
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
    const seo = getSiteConfig(loaderData?.siteKey ?? "corporate").seo;

    return {
      meta: [
        { title: `Sign In — ${seo.title}` },
        { name: "description", content: seo.description },
        { property: "og:title", content: `Sign In — ${seo.ogTitle ?? seo.title}` },
        { property: "og:description", content: seo.ogDescription ?? seo.description },
      ],
    };
  },
  component: HomePage,
});

function HomePage() {
  const { redirect: redirectTo, error } = Route.useSearch();

  return <EntityLoginPage redirect={redirectTo} error={error} />;
}
