import { createFileRoute, redirect } from "@tanstack/react-router";
import { NccLoginPage } from "@/components/ncc/ncc-login-page";
import { siteFromRouteContext } from "@/lib/site/site-context";

type LoginSearch = {
  redirect?: string;
  error?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: ({ search, context }) => {
    const site = siteFromRouteContext(context);
    if (site.key !== "ncc") {
      throw redirect({
        to: "/",
        search: {
          redirect: search.redirect,
          error: search.error,
        },
      });
    }

    if (context.user) {
      throw redirect({
        to: search.redirect ?? site.defaultAuthenticatedRoute,
        replace: true,
      });
    }
  },
  head: () => ({
    meta: [{ title: "Institution Sign-In — Newport Clearing Corporation" }],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  const { redirect: redirectTo, error } = Route.useSearch();
  return <NccLoginPage redirectTo={redirectTo} error={error} />;
}
