import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/**
 * Layout for /internal/exchange/* — only the bare /internal/exchange index
 * redirects home. Child routes (e.g. settings) must still load.
 */
export const Route = createFileRoute("/internal/exchange")({
  beforeLoad: ({ location }) => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (path === "/internal/exchange") {
      throw redirect({ to: "/internal" });
    }
  },
  component: () => <Outlet />,
});
