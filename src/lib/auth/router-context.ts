import type { QueryClient } from "@tanstack/react-query";
import type { AltaUser } from "@/lib/auth/types";
import type { SiteConfig } from "@/config/sites";

export interface AltaRouterContext {
  queryClient: QueryClient;
  user: AltaUser | null;
  site: SiteConfig;
}

declare module "@tanstack/react-router" {
  interface Register {
    routerContext: AltaRouterContext;
  }
}
