/**
 * Alta Accounting — private site wiring + access expectations.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSiteConfig, isSiteKey, SITE_CONFIGS } from "@/config/sites";
import { canAccessInternalForSite, isCorporateAdmin } from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import { centsToFlorins, florinsToCents } from "@/lib/accounting/format";
import { ECOSYSTEM_ENTRIES } from "@/lib/site/ecosystem-config";
import { resolveSiteKeyFromHost } from "@/lib/site/site-context";
import { siteKeyForOwnedPath } from "@/lib/site/site-path-ownership";
import { isKnownDevSiteKey } from "@/lib/site/preserve-dev-site-search";
import { FOOTER_COPYRIGHT_ENTITY, getFooterEcosystemLinks } from "@/lib/site/site-links";

function userWithTags(tags: AltaUser["tags"]): AltaUser {
  return {
    id: "u1",
    discordId: "1",
    discordUsername: "tester",
    avatarUrl: null,
    email: null,
    minecraftUsername: null,
    minecraftUuid: null,
    minecraftVerifiedAt: null,
    eligibilityConfirmedAt: null,
    coreOnboardingCompletedAt: null,
    onboardingCompletedAt: null,
    tags,
    accountStatus: "active",
    internalAccess: tags.includes("corporate_admin"),
    companyMemberships: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

describe("alta accounting private site", () => {
  it("registers accounting host and path ownership", () => {
    assert.ok(isSiteKey("accounting"));
    assert.equal(resolveSiteKeyFromHost("accounting.altagroup.dev"), "accounting");
    assert.equal(resolveSiteKeyFromHost("accounting.localhost"), "accounting");
    assert.equal(siteKeyForOwnedPath("/accounting"), "accounting");
    assert.equal(siteKeyForOwnedPath("/accounting/categories"), "accounting");
    assert.ok(isKnownDevSiteKey("accounting"));
    assert.equal(getSiteConfig("accounting").productionHosts[0], "accounting.altagroup.dev");
    assert.equal(SITE_CONFIGS.accounting.displayName, "Accounting Tracker");
    assert.equal(SITE_CONFIGS.accounting.wordmarkSuffix, "TRACKER");
  });

  it("is never listed in the public ecosystem switcher/footer entries", () => {
    assert.equal(
      ECOSYSTEM_ENTRIES.some((e) => e.key === "accounting" || /accounting/i.test(e.name)),
      false,
    );
    const links = getFooterEcosystemLinks("corporate");
    assert.equal(links.some((l) => /accounting/i.test(l.label)), false);
    assert.ok(FOOTER_COPYRIGHT_ENTITY.accounting);
  });

  it("limits accounting site internal access to corporate admins", () => {
    const admin = userWithTags(["corporate_admin"]);
    const bankOnly = userWithTags(["bank_admin"]);
    assert.equal(isCorporateAdmin(admin), true);
    assert.equal(canAccessInternalForSite(admin, "accounting"), true);
    assert.equal(canAccessInternalForSite(bankOnly, "accounting"), false);
    assert.equal(canAccessInternalForSite(userWithTags([]), "accounting"), false);
  });

  it("formats florins for ledger display", () => {
    assert.equal(centsToFlorins(9250000), "ƒ92,500.00");
    assert.equal(florinsToCents("12.34"), 1234);
  });
});
