import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AltaUser } from "@/lib/auth/types";
import {
  canAccessAnyInternal,
  canAccessBankInternal,
  canAccessInternal,
  canAccessInternalForSite,
  canBypassMaintenanceMode,
  isAdmin,
  isBankAdmin,
  isCorporateAdmin,
  isTerminalAdmin,
} from "@/lib/auth/permissions";

function userWithTags(tags: AltaUser["tags"]): AltaUser {
  return {
    id: "u1",
    discordId: "1",
    discordUsername: "tester",
    avatarUrl: null,
    email: null,
    minecraftUsername: null,
    tags,
    accountStatus: "active",
    developerAccessStatus: "none",
    developerAccess: false,
    internalAccess: tags.some((t) =>
      t === "corporate_admin" || t === "bank_admin" || t === "terminal_admin",
    ),
    companyMemberships: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

describe("site admin permissions", () => {
  it("maps corporate_admin as isAdmin / canAccessInternal", () => {
    const user = userWithTags(["corporate_admin"]);
    assert.equal(isCorporateAdmin(user), true);
    assert.equal(isAdmin(user), true);
    assert.equal(canAccessInternal(user), true);
    assert.equal(canAccessBankInternal(user), true);
    assert.equal(canAccessAnyInternal(user), true);
    assert.equal(canBypassMaintenanceMode(user), true);
  });

  it("gives bank_admin bank access only", () => {
    const user = userWithTags(["bank_admin"]);
    assert.equal(isBankAdmin(user), true);
    assert.equal(isAdmin(user), false);
    assert.equal(canAccessInternal(user), false);
    assert.equal(canAccessBankInternal(user), true);
    assert.equal(canAccessAnyInternal(user), true);
    assert.equal(canBypassMaintenanceMode(user), false);
    assert.equal(canAccessInternalForSite(user, "bank"), true);
    assert.equal(canAccessInternalForSite(user, "corporate"), false);
    assert.equal(canAccessInternalForSite(user, "terminal"), false);
  });

  it("gives terminal_admin terminal/exchange access only", () => {
    const user = userWithTags(["terminal_admin"]);
    assert.equal(isTerminalAdmin(user), true);
    assert.equal(canAccessBankInternal(user), false);
    assert.equal(canAccessInternalForSite(user, "terminal"), true);
    assert.equal(canAccessInternalForSite(user, "exchange"), true);
    assert.equal(canAccessInternalForSite(user, "bank"), false);
    assert.equal(canAccessInternalForSite(user, "corporate"), false);
    assert.equal(canBypassMaintenanceMode(user), false);
  });

  it("lets corporate_admin into every Alta internal site", () => {
    const user = userWithTags(["corporate_admin"]);
    assert.equal(canAccessInternalForSite(user, "corporate"), true);
    assert.equal(canAccessInternalForSite(user, "bank"), true);
    assert.equal(canAccessInternalForSite(user, "terminal"), true);
    assert.equal(canAccessInternalForSite(user, "exchange"), true);
  });
});
