import { useRouteContext } from "@tanstack/react-router";
import type { AltaUser } from "@/lib/auth/types";

export function useCurrentUser(): AltaUser | null {
  const { user } = useRouteContext({ from: "__root__" });
  return user ?? null;
}

export function useIsAuthenticated(): boolean {
  return useCurrentUser() != null;
}

export function useRequireCurrentUser(): AltaUser {
  const user = useCurrentUser();
  if (!user) throw new Error("useRequireCurrentUser called without authenticated user");
  return user;
}
