import type { AltaUser } from "@/lib/auth/types";
import type { SiteConfig } from "@/config/sites";

export interface AltaRouterContext {
  user: AltaUser | null;
  site: SiteConfig;
}

declare module "@tanstack/react-router" {
  interface Register {
    routerContext: AltaRouterContext;
  }
}
