import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout for /terminal/portfolio and /terminal/portfolio/$portfolioId.
 * Redirect for the bare path lives in portfolio/index.tsx so child routes
 * are not stuck in a parent redirect loop.
 */
export const Route = createFileRoute("/terminal/portfolio")({
  component: () => <Outlet />,
});
