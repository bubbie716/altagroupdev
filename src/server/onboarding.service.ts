/**
 * Core onboarding completion — eligibility + CORE legal bundle.
 * Atomic, idempotent, server-authoritative document resolution.
 */
import { getRequestHeader } from "@tanstack/react-start/server";
import type { AltaUser } from "@/lib/auth/types";
import type { SiteKey } from "@/config/sites";
import { prisma } from "@/server/db";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { recordConsentBundle, resolveCurrentConsentBundle } from "@/server/legal-consent.service";
import {
  hasCoreOnboarding,
  meetsCurrentOnboardingRequirement,
  ONBOARDING_PHASE_CONFIG,
  resolveOnboardingStep,
} from "@/lib/onboarding/onboarding-steps";
import {
  resolveSafeReturnDestination,
  sanitizeOnboardingReturnPath,
} from "@/lib/onboarding/safe-return";
import type {
  CoreOnboardingSubmitInput,
  CoreOnboardingSubmitResult,
  OnboardingLoaderState,
} from "@/lib/onboarding/onboarding-types";
import {
  invalidateSessionUserCache,
  setSessionUserCacheForCurrentRequest,
} from "@/server/auth.service";
import { getSessionCookieName, readCookie } from "@/server/session";

export type {
  CoreOnboardingSubmitInput,
  CoreOnboardingSubmitResult,
  OnboardingLoaderState,
} from "@/lib/onboarding/onboarding-types";

export async function submitCoreOnboarding(
  actor: AltaUser,
  input: CoreOnboardingSubmitInput,
): Promise<CoreOnboardingSubmitResult> {
  assertSubmitFlags(input);

  const sourceSite = input.sourceSite || "corporate";
  const destination = resolveSafeReturnDestination({
    returnPath: input.returnPath,
    returnOrigin: input.returnOrigin,
    currentSiteKey: sourceSite,
  });

  if (hasCoreOnboarding(actor)) {
    const fresh = await reloadUser(actor.id);
    return {
      user: fresh,
      step: resolveOnboardingStep(fresh),
      destination,
      alreadyComplete: true,
    };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: actor.id } });
    if (!current) throw new Error("USER_NOT_FOUND");
    if (current.coreOnboardingCompletedAt) return;

    await recordConsentBundle({
      userId: actor.id,
      scope: "CORE",
      sourceSite,
      tx,
    });

    await tx.user.update({
      where: { id: actor.id },
      data: {
        eligibilityConfirmedAt: current.eligibilityConfirmedAt ?? now,
        coreOnboardingCompletedAt: now,
      },
    });
  });

  const user = await reloadUser(actor.id);
  invalidateCachesAfterOnboardingChange(user);

  void writeOnboardingAudits(actor, sourceSite).catch((error) => {
    console.error("[onboarding] audit write failed", error);
  });

  return {
    user,
    step: resolveOnboardingStep(user),
    destination,
    alreadyComplete: false,
  };
}

function assertSubmitFlags(input: CoreOnboardingSubmitInput): void {
  if (!input.eligibilityConfirmed) {
    throw new Error("ONBOARDING_ELIGIBILITY_REQUIRED");
  }
  if (!input.termsAndAupAgreed) {
    throw new Error("ONBOARDING_TERMS_REQUIRED");
  }
  if (!input.privacyAndElectronicConsented) {
    throw new Error("ONBOARDING_PRIVACY_REQUIRED");
  }
}

async function writeOnboardingAudits(actor: AltaUser, sourceSite: string): Promise<void> {
  const { writeAuditLog } = await import("@/server/audit.service");
  const common = {
    actorUserId: actor.id,
    targetUserId: actor.id,
    entityId: actor.id,
    metadata: { source: "SYSTEM", sourceSite, severity: "info" },
  } as const;

  await writeAuditLog({
    ...common,
    action: "ONBOARDING_ELIGIBILITY_CONFIRMED",
    entityType: "ONBOARDING",
    description: "Eligibility confirmed (13+ self-attestation)",
  });

  await writeAuditLog({
    ...common,
    action: "ONBOARDING_CORE_LEGAL_ACCEPTED",
    entityType: "LEGAL_ACCEPTANCE",
    description: "Core legal bundle accepted",
  });

  await writeAuditLog({
    ...common,
    action: "ONBOARDING_CORE_COMPLETED",
    entityType: "ONBOARDING",
    description: "Core onboarding completed",
  });
}

function invalidateCachesAfterOnboardingChange(user: AltaUser): void {
  try {
    const cookieHeader = getRequestHeader("cookie");
    const token = readCookie(getSessionCookieName(), cookieHeader);
    invalidateSessionUserCache(token ?? undefined);
  } catch {
    invalidateSessionUserCache();
  }
  setSessionUserCacheForCurrentRequest(user);
}

async function reloadUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  return mapDbUserToAltaUser(user);
}

export async function loadOnboardingState(
  actor: AltaUser,
  input: {
    sourceSite: SiteKey;
    returnPath?: string | null;
    returnOrigin?: string | null;
  },
): Promise<OnboardingLoaderState> {
  const destination = resolveSafeReturnDestination({
    returnPath: input.returnPath,
    returnOrigin: input.returnOrigin,
    currentSiteKey: input.sourceSite,
  });

  const bundle = await resolveCurrentConsentBundle("CORE");
  const step = resolveOnboardingStep(actor);
  const { getActiveChallengeForUser } = await import(
    "@/server/minecraft-verification.service"
  );
  const minecraftChallenge =
    step === "minecraft" || step === "confirmation"
      ? await getActiveChallengeForUser(actor.id)
      : null;

  return {
    step,
    user: {
      id: actor.id,
      discordUsername: actor.discordUsername,
      avatarUrl: actor.avatarUrl,
      minecraftUsername: actor.minecraftUsername,
      minecraftUuid: actor.minecraftUuid,
      minecraftVerifiedAt: actor.minecraftVerifiedAt,
      eligibilityConfirmedAt: actor.eligibilityConfirmedAt,
      coreOnboardingCompletedAt: actor.coreOnboardingCompletedAt,
      onboardingCompletedAt: actor.onboardingCompletedAt,
    },
    coreDocuments: bundle.documents.map((d) => ({
      documentId: d.documentId,
      title: d.title,
      label: d.label,
      version: d.version,
      publicPath: d.publicPath,
      acceptanceType: d.acceptanceType,
    })),
    destination,
    meetsRequirement: meetsCurrentOnboardingRequirement(actor, ONBOARDING_PHASE_CONFIG),
    minecraftChallenge,
  };
}

export function sanitizeOnboardingRedirectPath(
  path: string | null | undefined,
  fallback: string,
): string {
  return sanitizeOnboardingReturnPath(path, fallback);
}
