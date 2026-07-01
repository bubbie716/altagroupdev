import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import type { AltaRouterContext } from "@/lib/auth/router-context";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient, user: null } satisfies AltaRouterContext,
    scrollRestoration: false,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
