import { useRouterState } from "@tanstack/react-router";

type RouterSnapshot = {
  location: { pathname: string };
  resolvedLocation?: { pathname: string } | null;
};

/** Pathname of the route currently rendered — lags behind location while loaders run. */
export function useResolvedPathname(): string {
  return useRouterState({
    select: (state) => {
      const snapshot = state as RouterSnapshot;
      return snapshot.resolvedLocation?.pathname ?? snapshot.location.pathname;
    },
  });
}
