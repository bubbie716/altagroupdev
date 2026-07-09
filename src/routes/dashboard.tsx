import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { resolveLegacyDashboardPath } from "@/lib/site/site-shortcut-routes";

function normalizePath(path: string): string {
  return path.replace(/\/$/, "") || "/";
}

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context, location }) => {
    const target = resolveLegacyDashboardPath(context.site.key);
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
