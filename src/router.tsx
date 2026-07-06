import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { RoutePendingFallback } from "@/components/ui/loading-indicator";
import { ROUTE_PENDING_MIN_MS, ROUTE_PENDING_MS } from "@/lib/ui/route-loading";
import { routeTree } from "./routeTree.gen";
import { getDefaultSiteConfig } from "@/config/sites";
import type { AltaRouterContext } from "@/lib/auth/router-context";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient, user: null, site: getDefaultSiteConfig() } satisfies AltaRouterContext,
    scrollRestoration: false,
    defaultPreloadStaleTime: 30_000,
    defaultStaleTime: 30_000,
    defaultGcTime: 5 * 60_000,
    defaultPendingMs: ROUTE_PENDING_MS,
    defaultPendingMinMs: ROUTE_PENDING_MIN_MS,
    defaultPendingComponent: RoutePendingFallback,
  });

  return router;
};
