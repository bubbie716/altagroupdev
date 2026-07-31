import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { siteKeyForOwnedPath } from "@/lib/site/site-path-ownership";
import { sanitizeOnboardingReturnPath } from "@/lib/onboarding/safe-return";
import { shouldEnforceOnboarding } from "@/lib/onboarding/onboarding-gate";
import { DEFAULT_ONBOARDING_USER_FIELDS } from "@/lib/auth/onboarding-user-defaults";
import type { AltaUser } from "@/lib/auth/types";

function user(overrides: Partial<AltaUser> = {}): AltaUser {
  return {
    id: "u1",
    discordId: "d1",
    discordUsername: "carter",
    avatarUrl: null,
    email: null,
    minecraftUsername: "existingName",
    ...DEFAULT_ONBOARDING_USER_FIELDS,
    tags: [],
    accountStatus: "active",
    internalAccess: false,
    companyMemberships: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    lastLoginAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("onboarding site routing", () => {
  it("treats /onboarding as a shared path across hosts", () => {
    assert.equal(siteKeyForOwnedPath("/onboarding"), null);
    assert.equal(siteKeyForOwnedPath("/onboarding/"), null);
  });

  it("gates existing authenticated users with minecraftUsername but no formal consent", () => {
    const existing = user();
    assert.equal(existing.minecraftUsername, "existingName");
    assert.equal(existing.minecraftVerifiedAt, null);
    assert.equal(shouldEnforceOnboarding(existing, "/bank"), true);
  });

  it("gates existing users with username but no minecraftVerifiedAt after core consent", () => {
    const existing = user({
      coreOnboardingCompletedAt: "2026-07-01T00:00:00.000Z",
      minecraftUsername: "existingName",
    });
    assert.equal(shouldEnforceOnboarding(existing, "/terminal"), true);
    assert.equal(shouldEnforceOnboarding(existing, "/home"), true);
  });

  it("rejects open redirects used as post-onboarding destinations", () => {
    assert.equal(sanitizeOnboardingReturnPath("//attacker.test", "/terminal"), "/terminal");
    assert.equal(sanitizeOnboardingReturnPath("https://attacker.test", "/bank"), "/bank");
  });
});
