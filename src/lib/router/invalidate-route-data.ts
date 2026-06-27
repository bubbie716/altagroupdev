import type { AnyRouter } from "@tanstack/react-router";

/** Refresh active route loaders without re-running root auth/maintenance checks. */
export async function invalidateRouteData(router: AnyRouter) {
  await router.invalidate({
    filter: (match) => match.routeId !== "__root__",
  });
}
