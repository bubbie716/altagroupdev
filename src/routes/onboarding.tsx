import { createFileRoute, redirect } from "@tanstack/react-router";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { fetchOnboardingState } from "@/lib/onboarding/onboarding.functions";
import { getUiLabOnboardingScenario } from "@/lib/onboarding/ui-lab-onboarding";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { siteFromRouteContext } from "@/lib/site/site-context";
import { resolveSiteSignInPath, buildSignInSearch } from "@/lib/site/site-sign-in-path";
import type { SiteKey } from "@/config/sites";

type OnboardingSearch = {
  redirect?: string;
  returnOrigin?: string;
  site?: string;
  uiLabScenario?: string;
};

function parseOnboardingSearch(search: Record<string, unknown>): OnboardingSearch {
  return {
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    returnOrigin: typeof search.returnOrigin === "string" ? search.returnOrigin : undefined,
    site: typeof search.site === "string" ? search.site : undefined,
    uiLabScenario: typeof search.uiLabScenario === "string" ? search.uiLabScenario : undefined,
  };
}

export const Route = createFileRoute("/onboarding")({
  validateSearch: (search: Record<string, unknown>) => parseOnboardingSearch(search),
  beforeLoad: ({ context, location }) => {
    if (isUiLabMode()) return;
    if (!context.user) {
      const site = siteFromRouteContext(context);
      throw redirect({
        to: resolveSiteSignInPath(site.key),
        search: buildSignInSearch(site.key, location.pathname),
      });
    }
  },
  loader: async ({ context, location }) => {
    const site = siteFromRouteContext(context);
    const search = parseOnboardingSearch(
      (location.search ?? {}) as Record<string, unknown>,
    );
    const sourceSite = (search.site as SiteKey | undefined) ?? site.key;

    const state = await fetchOnboardingState({
      data: {
        sourceSite,
        returnPath: search.redirect ?? null,
        returnOrigin: search.returnOrigin ?? null,
        ...(isUiLabMode()
          ? {
              uiLabScenario:
                search.uiLabScenario ?? getUiLabOnboardingScenario(),
            }
          : {}),
      },
    });

    return {
      state,
      sourceSite,
      returnPath: search.redirect ?? null,
      returnOrigin: search.returnOrigin ?? null,
    };
  },
  component: OnboardingPage,
  head: () => ({
    meta: [
      { title: "Welcome to Alta" },
      {
        name: "description",
        content: "Complete Alta eligibility, agreements, and Minecraft verification to continue.",
      },
    ],
  }),
});

function OnboardingPage() {
  const { state, sourceSite, returnPath, returnOrigin } = Route.useLoaderData();

  return (
    <OnboardingFlow
      initial={state}
      sourceSite={sourceSite}
      returnPath={returnPath}
      returnOrigin={returnOrigin}
    />
  );
}
