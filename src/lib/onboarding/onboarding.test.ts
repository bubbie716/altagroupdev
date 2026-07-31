import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasCoreOnboarding,
  hasMinecraftVerification,
  meetsCurrentOnboardingRequirement,
  minecraftVerificationStatusLabel,
  resolveOnboardingProgress,
  resolveOnboardingStep,
  continueButtonLabel,
  ONBOARDING_PHASE_CONFIG,
} from "@/lib/onboarding/onboarding-steps";
import {
  shouldEnforceOnboarding,
  isOnboardingExemptPath,
  buildOnboardingRedirect,
} from "@/lib/onboarding/onboarding-gate";
import {
  sanitizeOnboardingReturnPath,
  sanitizeOnboardingReturnOrigin,
  resolveSafeReturnDestination,
} from "@/lib/onboarding/safe-return";
import {
  CORE_CONSENT_BUNDLE,
  ENFORCED_CONSENT_SCOPES,
  isConsentScopeEnforced,
  resolveConsentBundleDocuments,
} from "@/lib/legal/legal-consent-bundle";
import { hashLegalDocumentContentSync } from "@/lib/legal/legal-content-hash";
import type { AltaUser } from "@/lib/auth/types";
import { DEFAULT_ONBOARDING_USER_FIELDS } from "@/lib/auth/onboarding-user-defaults";
import { assertNotUiLabMutation } from "@/lib/internal/ui-lab-mutation-gate";

function user(overrides: Partial<AltaUser> = {}): AltaUser {
  return {
    id: "u1",
    discordId: "d1",
    discordUsername: "carter",
    avatarUrl: null,
    email: null,
    minecraftUsername: null,
    ...DEFAULT_ONBOARDING_USER_FIELDS,
    tags: [],
    accountStatus: "active",
    internalAccess: false,
    companyMemberships: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("onboarding step resolver", () => {
  it("starts new users at welcome", () => {
    assert.equal(resolveOnboardingStep(user()), "welcome");
  });

  it("routes core-complete users to Minecraft when verification is required", () => {
    const u = user({
      eligibilityConfirmedAt: "2026-07-01T00:00:00.000Z",
      coreOnboardingCompletedAt: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(resolveOnboardingStep(u), "minecraft");
    assert.equal(hasCoreOnboarding(u), true);
    assert.equal(meetsCurrentOnboardingRequirement(u), false);
  });

  it("never treats minecraftUsername as verified", () => {
    const u = user({
      coreOnboardingCompletedAt: "2026-07-01T00:00:00.000Z",
      minecraftUsername: "NotActuallyVerified",
    });
    assert.equal(hasMinecraftVerification(u), false);
    assert.equal(minecraftVerificationStatusLabel(u), "Not verified");
    assert.equal(resolveOnboardingStep(u), "minecraft");
  });

  it("Phase 2 requires minecraftVerifiedAt and onboardingCompletedAt", () => {
    assert.equal(ONBOARDING_PHASE_CONFIG.requireMinecraftVerification, true);
    const u = user({
      coreOnboardingCompletedAt: "2026-07-01T00:00:00.000Z",
      minecraftUsername: "carter",
    });
    assert.equal(meetsCurrentOnboardingRequirement(u), false);
    assert.equal(resolveOnboardingStep(u), "minecraft");

    const verifiedOnly = user({
      coreOnboardingCompletedAt: "2026-07-01T00:00:00.000Z",
      minecraftVerifiedAt: "2026-07-02T00:00:00.000Z",
    });
    assert.equal(meetsCurrentOnboardingRequirement(verifiedOnly), false);

    const complete = user({
      coreOnboardingCompletedAt: "2026-07-01T00:00:00.000Z",
      minecraftVerifiedAt: "2026-07-02T00:00:00.000Z",
      onboardingCompletedAt: "2026-07-02T00:00:00.000Z",
    });
    assert.equal(meetsCurrentOnboardingRequirement(complete), true);
    assert.equal(resolveOnboardingStep(complete), "confirmation");
  });

  it("reports Phase 2 progress including Minecraft step", () => {
    const progress = resolveOnboardingProgress("legal");
    assert.equal(progress.total, 4);
    assert.equal(progress.current, 2);
    assert.equal(resolveOnboardingProgress("minecraft").current, 3);
  });

  it("labels continue buttons by destination site", () => {
    assert.equal(continueButtonLabel("corporate"), "Continue to Alta Group");
    assert.equal(continueButtonLabel("bank"), "Continue to Alta Bank");
    assert.equal(continueButtonLabel("terminal"), "Continue to Alta Terminal");
  });
});

describe("onboarding route gate", () => {
  it("does not gate unauthenticated marketing visitors", () => {
    assert.equal(shouldEnforceOnboarding(null, "/home"), false);
    assert.equal(shouldEnforceOnboarding(null, "/company"), false);
    assert.equal(isOnboardingExemptPath("/home", false), true);
  });

  it("gates authenticated users missing core onboarding", () => {
    assert.equal(shouldEnforceOnboarding(user(), "/bank"), true);
    assert.equal(shouldEnforceOnboarding(user(), "/terminal"), true);
    assert.equal(shouldEnforceOnboarding(user(), "/internal"), true);
  });

  it("gates users with core consent but missing Minecraft verification", () => {
    const u = user({
      coreOnboardingCompletedAt: "2026-07-01T00:00:00.000Z",
      minecraftUsername: "carter",
    });
    assert.equal(shouldEnforceOnboarding(u, "/bank"), true);
    assert.equal(shouldEnforceOnboarding(u, "/internal"), true);
  });

  it("allows onboarding, legal, logout-related, and auth paths", () => {
    const u = user();
    assert.equal(shouldEnforceOnboarding(u, "/onboarding"), false);
    assert.equal(shouldEnforceOnboarding(u, "/legal"), false);
    assert.equal(shouldEnforceOnboarding(u, "/legal/terms"), false);
    assert.equal(shouldEnforceOnboarding(u, "/support"), false);
    assert.equal(shouldEnforceOnboarding(u, "/api/auth/discord"), false);
    assert.equal(shouldEnforceOnboarding(u, "/api/auth/session/handoff"), false);
    assert.equal(shouldEnforceOnboarding(u, "/status"), false);
    assert.equal(shouldEnforceOnboarding(u, "/"), false);
  });

  it("does not gate fully verified users", () => {
    const u = user({
      coreOnboardingCompletedAt: "2026-07-01T00:00:00.000Z",
      minecraftVerifiedAt: "2026-07-02T00:00:00.000Z",
      onboardingCompletedAt: "2026-07-02T00:00:00.000Z",
    });
    assert.equal(shouldEnforceOnboarding(u, "/bank"), false);
  });

  it("preserves safe return path when building redirect", () => {
    const redirect = buildOnboardingRedirect({
      pathname: "/bank/accounts",
      siteKey: "bank",
      returnOrigin: "https://bank.altagroup.dev",
    });
    assert.equal(redirect.to, "/onboarding");
    assert.equal(redirect.search.redirect, "/bank/accounts");
    assert.equal(redirect.search.returnOrigin, "https://bank.altagroup.dev");
  });
});

describe("safe return destinations", () => {
  it("rejects external and protocol-relative redirects", () => {
    assert.equal(sanitizeOnboardingReturnPath("https://evil.example/x", "/home"), "/home");
    assert.equal(sanitizeOnboardingReturnPath("//evil.example/x", "/home"), "/home");
    assert.equal(sanitizeOnboardingReturnPath("/\\evil.example", "/home"), "/home");
    assert.equal(sanitizeOnboardingReturnOrigin("https://evil.example"), null);
  });

  it("accepts safe internal paths and known Alta origins", () => {
    assert.equal(sanitizeOnboardingReturnPath("/bank", "/home"), "/bank");
    assert.equal(
      sanitizeOnboardingReturnOrigin("https://bank.altagroup.dev"),
      "https://bank.altagroup.dev",
    );
  });

  it("falls back when external redirect is supplied", () => {
    const dest = resolveSafeReturnDestination({
      returnPath: "https://evil.example/phish",
      returnOrigin: "https://evil.example",
      currentSiteKey: "corporate",
    });
    assert.equal(dest.path, "/home");
    assert.equal(dest.origin, null);
  });
});

describe("core legal consent bundle", () => {
  it("uses authoritative registry IDs and versions", () => {
    const docs = resolveConsentBundleDocuments(CORE_CONSENT_BUNDLE);
    assert.deepEqual(
      docs.map((d) => d.documentId),
      ["AG-LEGAL-001", "AG-LEGAL-004", "AG-LEGAL-002", "AG-LEGAL-005"],
    );
    assert.equal(docs.find((d) => d.documentId === "AG-LEGAL-001")?.version, "1.1");
    assert.equal(docs.find((d) => d.documentId === "AG-LEGAL-004")?.version, "1.0");
    assert.equal(docs.find((d) => d.documentId === "AG-LEGAL-002")?.version, "1.1");
    assert.equal(docs.find((d) => d.documentId === "AG-LEGAL-005")?.version, "1.0");
    assert.equal(docs.find((d) => d.documentId === "AG-LEGAL-001")?.acceptanceType, "AGREED");
    assert.equal(docs.find((d) => d.documentId === "AG-LEGAL-002")?.acceptanceType, "ACKNOWLEDGED");
    assert.equal(docs.find((d) => d.documentId === "AG-LEGAL-005")?.acceptanceType, "CONSENTED");
  });

  it("enforces CORE and progressive product scopes in Phase 3", () => {
    assert.ok(ENFORCED_CONSENT_SCOPES.includes("CORE"));
    assert.ok(ENFORCED_CONSENT_SCOPES.includes("BANK"));
    assert.ok(ENFORCED_CONSENT_SCOPES.includes("TERMINAL"));
    assert.ok(ENFORCED_CONSENT_SCOPES.includes("ALTA_PAY"));
    assert.ok(ENFORCED_CONSENT_SCOPES.includes("ALTA_CARD"));
    assert.ok(ENFORCED_CONSENT_SCOPES.includes("LENDING"));
    assert.ok(ENFORCED_CONSENT_SCOPES.includes("COMMERCIAL"));
    assert.equal(isConsentScopeEnforced("CORE"), true);
    assert.equal(isConsentScopeEnforced("BANK"), true);
    assert.equal(isConsentScopeEnforced("TERMINAL"), true);
  });

  it("hashes legal content stably", () => {
    const a = hashLegalDocumentContentSync("hello\nworld");
    const b = hashLegalDocumentContentSync("hello\r\nworld");
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{64}$/);
  });
});

describe("UI Lab mutation gate for onboarding", () => {
  it("assertNotUiLabMutation is available for acceptance writes", () => {
    assert.doesNotThrow(() => assertNotUiLabMutation("Core onboarding acceptance"));
  });
});
