import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AltaUser } from "@/lib/auth/types";
import {
  assertEntityInternalRouteAccess,
  internalHomePathForSite,
} from "@/lib/internal/entity-internal-scope";

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
    internalAccess: true,
    companyMemberships: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

describe("entity-internal-scope", () => {
  it("maps internal home paths by site", () => {
    assert.equal(internalHomePathForSite("corporate"), "/internal");
    assert.equal(internalHomePathForSite("bank"), "/internal/bank");
    assert.equal(internalHomePathForSite("exchange"), "/internal");
    assert.equal(internalHomePathForSite("terminal"), "/internal");
  });

  it("sends bank-only admins to the bank home", () => {
    const bankAdmin = userWithTags(["bank_admin"]);
    assert.equal(internalHomePathForSite("corporate", bankAdmin), "/internal/bank");
    assert.equal(internalHomePathForSite("bank", bankAdmin), "/internal/bank");
  });

  it("allows corporate and bank routes without redirect when no user tag check needed", () => {
    assert.doesNotThrow(() => assertEntityInternalRouteAccess("corporate", "/internal/settings"));
    assert.doesNotThrow(() => assertEntityInternalRouteAccess("bank", "/internal/bank/accounts"));
  });

  it("allows exchange and terminal settings routes only on their own sites", () => {
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("exchange", "/internal/exchange/settings"),
    );
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("terminal", "/internal/terminal/settings"),
    );
  });

  it("redirects exchange/terminal away from unrelated internal routes", () => {
    assert.throws(() => assertEntityInternalRouteAccess("terminal", "/internal/settings"));
    assert.throws(() => assertEntityInternalRouteAccess("exchange", "/internal/bank"));
  });

  it("lets corporate admins use any Alta internal path", () => {
    const admin = userWithTags(["corporate_admin"]);
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("corporate", "/internal/settings", admin),
    );
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("bank", "/internal/bank/accounts", admin),
    );
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("terminal", "/internal/terminal/settings", admin),
    );
  });

  it("keeps bank admins on bank panel paths", () => {
    const bankAdmin = userWithTags(["bank_admin"]);
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("bank", "/internal/bank/accounts", bankAdmin),
    );
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("bank", "/internal/queues/deposits", bankAdmin),
    );
    assert.throws(() => assertEntityInternalRouteAccess("bank", "/internal/settings", bankAdmin));
    assert.throws(() => assertEntityInternalRouteAccess("corporate", "/internal/bank", bankAdmin));
  });

  it("keeps terminal admins on terminal panel paths", () => {
    const terminalAdmin = userWithTags(["terminal_admin"]);
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("terminal", "/internal/terminal/settings", terminalAdmin),
    );
    assert.throws(() =>
      assertEntityInternalRouteAccess("terminal", "/internal/settings", terminalAdmin),
    );
    assert.throws(() =>
      assertEntityInternalRouteAccess("bank", "/internal/bank", terminalAdmin),
    );
  });
});
