import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

function normalizePath(path: string): string {
  return path.replace(/\/$/, "") || "/";
}

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context, location }) => {
    const target = context.site.dashboardRoute;
    if (normalizePath(location.pathname) === normalizePath(target)) {
      return;
    }
    throw redirect({ to: target, replace: true });
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return <Outlet />;
}
