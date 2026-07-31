import { createServerFn } from "@tanstack/react-start";
import type { SiteKey } from "@/config/sites";
import type { CoreOnboardingSubmitInput } from "@/lib/onboarding/onboarding-types";

async function requireActor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

export const fetchOnboardingState = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      sourceSite?: SiteKey;
      returnPath?: string | null;
      returnOrigin?: string | null;
      uiLabScenario?: string;
    }) => input ?? {},
  )
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabOnboardingState } = await import("@/lib/onboarding/ui-lab-onboarding");
      return getUiLabOnboardingState({
        scenario: data.uiLabScenario,
        sourceSite: data.sourceSite ?? "corporate",
        returnPath: data.returnPath,
        returnOrigin: data.returnOrigin,
      });
    }

    const user = await requireActor();
    const { loadOnboardingState } = await import("@/server/onboarding.service");
    return loadOnboardingState(user, {
      sourceSite: data.sourceSite ?? "corporate",
      returnPath: data.returnPath,
      returnOrigin: data.returnOrigin,
    });
  });

export const submitCoreOnboardingFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: CoreOnboardingSubmitInput & { uiLabScenario?: string }) => input,
  )
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { mockUiLabCoreOnboardingSubmit } = await import(
        "@/lib/onboarding/ui-lab-onboarding"
      );
      const { uiLabScenario, ...payload } = data;
      return mockUiLabCoreOnboardingSubmit(payload, uiLabScenario);
    }

    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Core onboarding acceptance");

    const user = await requireActor();
    const { submitCoreOnboarding } = await import("@/server/onboarding.service");
    const { uiLabScenario: _ignored, ...payload } = data;
    void _ignored;
    return submitCoreOnboarding(user, payload);
  });

export const createMinecraftChallengeFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { claimedUsername: string; uiLabScenario?: string }) => input,
  )
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { mockUiLabCreateMinecraftChallenge } = await import(
        "@/lib/onboarding/ui-lab-minecraft"
      );
      return mockUiLabCreateMinecraftChallenge(data.claimedUsername, data.uiLabScenario);
    }
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Minecraft challenge creation");
    const user = await requireActor();
    const { createMinecraftChallenge } = await import(
      "@/server/minecraft-verification.service"
    );
    return createMinecraftChallenge(user, data.claimedUsername);
  });

export const checkMinecraftLocationFn = createServerFn({ method: "POST" })
  .inputValidator((input: { uiLabScenario?: string } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { mockUiLabCheckMinecraftLocation } = await import(
        "@/lib/onboarding/ui-lab-minecraft"
      );
      return mockUiLabCheckMinecraftLocation(data.uiLabScenario);
    }
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Minecraft location check");
    const user = await requireActor();
    const { checkMinecraftLocation } = await import(
      "@/server/minecraft-verification.service"
    );
    return checkMinecraftLocation(user);
  });

export const fetchCustomerOnboardingSummary = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabCustomerOnboardingSummary } = await import(
        "@/lib/onboarding/ui-lab-onboarding"
      );
      return getUiLabCustomerOnboardingSummary(userId);
    }

    const { requireOperator } = await import("@/server/permissions.service");
    await requireOperator();
    const { getCustomerOnboardingSummary } = await import(
      "@/server/onboarding-summary.service"
    );
    return getCustomerOnboardingSummary(userId);
  });

export const operatorResetMinecraftChallengeFn = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Minecraft challenge reset");
    const { requireOperator } = await import("@/server/permissions.service");
    const actor = await requireOperator();
    const { canAccessBankInternal, isCorporateAdmin } = await import(
      "@/lib/auth/permissions"
    );
    if (!isCorporateAdmin(actor) && !canAccessBankInternal(actor)) {
      throw new Error("FORBIDDEN");
    }
    const { operatorResetMinecraftChallenge } = await import(
      "@/server/minecraft-verification.service"
    );
    await operatorResetMinecraftChallenge(actor, data.userId, data.reason);
    return { ok: true as const };
  });

export const operatorRequireMinecraftReverificationFn = createServerFn({
  method: "POST",
})
  .inputValidator((input: { userId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Minecraft reverification requirement");
    const { requireOperator } = await import("@/server/permissions.service");
    const actor = await requireOperator();
    const { isCorporateAdmin } = await import("@/lib/auth/permissions");
    if (!isCorporateAdmin(actor)) {
      throw new Error("FORBIDDEN");
    }
    const { operatorRequireMinecraftReverification } = await import(
      "@/server/minecraft-verification.service"
    );
    await operatorRequireMinecraftReverification(actor, data.userId, data.reason);
    return { ok: true as const };
  });
