import { createFileRoute, redirect } from "@tanstack/react-router";
import { NccLoginPage } from "@/components/ncc/ncc-login-page";

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
    if (context.site.key !== "ncc") {
      throw redirect({
        to: "/",
        search: {
          redirect: search.redirect,
          error: search.error,
        },
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
