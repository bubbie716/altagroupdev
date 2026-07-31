/**
 * Read-only onboarding summary for internal customer records.
 */
import { prisma } from "@/server/db";
import { getConsentBundleStatus, listUserAcceptanceHistory } from "@/server/legal-consent.service";
import { getLegalDocument } from "@/lib/legal/legal-document-registry";
import { humanizeAcceptanceType } from "@/lib/legal/consent-scopes";
import { minecraftVerificationStatusLabel } from "@/lib/onboarding/onboarding-steps";
import type { CustomerOnboardingSummary } from "@/lib/onboarding/onboarding-types";
import type { AltaUser } from "@/lib/auth/types";

export type { CustomerOnboardingSummary } from "@/lib/onboarding/onboarding-types";

const INTERNAL_SUMMARY_ACTOR: AltaUser = {
  id: "internal-loader",
  discordId: "",
  discordUsername: "",
  avatarUrl: null,
  email: null,
  minecraftUsername: null,
  tags: ["bank_admin"],
  accountStatus: "active",
  internalAccess: true,
  companyMemberships: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  lastLoginAt: "2026-01-01T00:00:00.000Z",
  eligibilityConfirmedAt: null,
  coreOnboardingCompletedAt: null,
  onboardingCompletedAt: null,
  minecraftUuid: null,
  minecraftVerifiedAt: null,
};

export async function getCustomerOnboardingSummary(
  userId: string,
): Promise<CustomerOnboardingSummary> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      eligibilityConfirmedAt: true,
      coreOnboardingCompletedAt: true,
      onboardingCompletedAt: true,
      minecraftUsername: true,
      minecraftUuid: true,
      minecraftVerifiedAt: true,
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const [bundleStatus, history, challenge] = await Promise.all([
    getConsentBundleStatus(userId, "CORE"),
    listUserAcceptanceHistory(userId, { scope: "CORE", limit: 20 }),
    prisma.minecraftVerificationChallenge.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const activeHistory = history.filter((h) => !h.supersededAt && !h.withdrawnAt);

  let productConsentScopes: CustomerOnboardingSummary["productConsentScopes"] = [];
  let commercialActingFor: CustomerOnboardingSummary["commercialActingFor"] = [];
  try {
    const { getCustomerProductConsentSummary } = await import(
      "@/server/product-consent-summary.service"
    );
    const product = await getCustomerProductConsentSummary(userId, INTERNAL_SUMMARY_ACTOR);
    productConsentScopes = product.scopes.map((s) => ({
      scope: s.scope,
      label: s.label,
      status: s.status,
      currentVersions: s.currentVersions,
      acceptedVersions: s.acceptedVersions,
      acceptedAt: s.acceptedAt,
      acceptanceSemantics: s.acceptanceSemantics,
      sourceSite: s.sourceSite,
      companyId: s.companyId,
      companyName: s.companyName,
    }));
    commercialActingFor = product.commercialActingFor.map((s) => ({
      scope: s.scope,
      label: s.label,
      status: s.status,
      companyId: s.companyId,
      companyName: s.companyName,
      acceptedAt: s.acceptedAt,
      sourceSite: s.sourceSite,
    }));
  } catch {
    productConsentScopes = [];
    commercialActingFor = [];
  }

  return {
    coreOnboardingComplete: Boolean(user.coreOnboardingCompletedAt),
    eligibilityConfirmedAt: user.eligibilityConfirmedAt?.toISOString() ?? null,
    coreOnboardingCompletedAt: user.coreOnboardingCompletedAt?.toISOString() ?? null,
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
    minecraftStatus: minecraftVerificationStatusLabel({
      eligibilityConfirmedAt: user.eligibilityConfirmedAt?.toISOString() ?? null,
      coreOnboardingCompletedAt: user.coreOnboardingCompletedAt?.toISOString() ?? null,
      onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
      minecraftVerifiedAt: user.minecraftVerifiedAt?.toISOString() ?? null,
      minecraftUsername: user.minecraftUsername,
      minecraftUuid: user.minecraftUuid,
    }),
    minecraftUsername: user.minecraftUsername,
    minecraftUuid: user.minecraftUuid,
    minecraftVerifiedAt: user.minecraftVerifiedAt?.toISOString() ?? null,
    legalBundleStatus: bundleStatus.complete
      ? "Current"
      : bundleStatus.requiresReacceptance
        ? "Reacceptance required"
        : "Missing",
    acceptedDocuments: activeHistory.map((row) => ({
      documentId: row.documentId,
      title: getLegalDocument(row.documentId)?.title ?? row.documentId,
      version: row.documentVersion,
      acceptanceType: humanizeAcceptanceType(row.acceptanceType),
      acceptedAt: row.acceptedAt,
    })),
    productConsentScopes,
    commercialActingFor,
    challenge: challenge
      ? {
          status: challenge.status,
          claimedUsername: challenge.claimedUsername,
          targetX: challenge.targetX,
          targetZ: challenge.targetZ,
          expiresAt: challenge.expiresAt.toISOString(),
          attemptCount: challenge.attemptCount,
          regenerationCount: challenge.regenerationCount,
        }
      : null,
  };
}
