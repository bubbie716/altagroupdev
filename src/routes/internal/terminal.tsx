import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/**
 * Layout for /internal/terminal/* — only the bare /internal/terminal index
 * redirects home. Child routes (e.g. settings) must still load.
 */
export const Route = createFileRoute("/internal/terminal")({
  beforeLoad: ({ location }) => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (path === "/internal/terminal") {
      throw redirect({ to: "/internal" });
    }
  },
  component: () => <Outlet />,
});
