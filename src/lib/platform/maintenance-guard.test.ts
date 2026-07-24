import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AltaUser } from "@/lib/auth/types";
import {
  isMaintenanceAlwaysExemptPath,
  isMaintenanceSignInPath,
  shouldEnforceMaintenance,
} from "@/lib/platform/maintenance-guard";

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
    internalAccess: tags.includes("corporate_admin"),
    companyMemberships: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

describe("maintenance guard", () => {
  it("always exempts maintenance and API paths", () => {
    assert.equal(isMaintenanceAlwaysExemptPath("/maintenance"), true);
    assert.equal(isMaintenanceAlwaysExemptPath("/api/auth/discord"), true);
    assert.equal(isMaintenanceAlwaysExemptPath("/bank"), false);
  });

  it("treats / and /login as sign-in surfaces", () => {
    assert.equal(isMaintenanceSignInPath("/"), true);
    assert.equal(isMaintenanceSignInPath("/login"), true);
    assert.equal(isMaintenanceSignInPath("/login/"), true);
    assert.equal(isMaintenanceSignInPath("/bank"), false);
  });

  it("lets unsigned users reach sign-in during maintenance", () => {
    assert.equal(shouldEnforceMaintenance("/", null), false);
    assert.equal(shouldEnforceMaintenance("/login", null), false);
    assert.equal(shouldEnforceMaintenance("/bank", null), true);
    assert.equal(shouldEnforceMaintenance("/terminal", null), true);
  });

  it("keeps signed-in non-admins behind maintenance", () => {
    const member = userWithTags([]);
    const privateClient = userWithTags(["private_client"]);
    const bankAdmin = userWithTags(["bank_admin"]);
    assert.equal(shouldEnforceMaintenance("/", member), true);
    assert.equal(shouldEnforceMaintenance("/bank", member), true);
    assert.equal(shouldEnforceMaintenance("/", privateClient), true);
    assert.equal(shouldEnforceMaintenance("/internal", privateClient), true);
    assert.equal(shouldEnforceMaintenance("/bank", bankAdmin), true);
  });

  it("lets corporate admins bypass maintenance everywhere except lockout paths still work", () => {
    const admin = userWithTags(["corporate_admin"]);
    assert.equal(shouldEnforceMaintenance("/", admin), false);
    assert.equal(shouldEnforceMaintenance("/bank", admin), false);
    assert.equal(shouldEnforceMaintenance("/internal", admin), false);
    assert.equal(shouldEnforceMaintenance("/maintenance", admin), false);
  });
});
