import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

/** Legacy path — redirects to /structure. */
export const Route = createFileRoute("/governance")({
  beforeLoad: ({ location }) => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (path === "/governance") {
      throw redirect({ to: "/structure", replace: true });
    }
  },
  component: () => <Outlet />,
});
