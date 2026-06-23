import type { QueryClient } from "@tanstack/react-query";
import type { AltaUser } from "@/lib/auth/types";

export interface AltaRouterContext {
  queryClient: QueryClient;
  user: AltaUser | null;
}

declare module "@tanstack/react-router" {
  interface Register {
    routerContext: AltaRouterContext;
  }
}
