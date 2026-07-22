import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BANK_INTERNAL_NAV_GROUPS,
  getInternalNavGroupsForSite,
  INTERNAL_NAV_GROUPS,
} from "@/components/internal/console/internal-nav-config";

describe("internal-nav-config", () => {
  it("returns full nav for corporate and bank-scoped nav for bank", () => {
    assert.equal(getInternalNavGroupsForSite("corporate"), INTERNAL_NAV_GROUPS);
    assert.equal(getInternalNavGroupsForSite("bank"), BANK_INTERNAL_NAV_GROUPS);
    assert.equal(getInternalNavGroupsForSite("exchange"), null);
    assert.equal(getInternalNavGroupsForSite("terminal"), null);
  });

  it("points bank dashboard to bank ops home", () => {
    const dashboard = BANK_INTERNAL_NAV_GROUPS.find((group) => group.id === "dashboard");
    assert.equal(dashboard?.links[0]?.to, "/internal/bank");
  });

  it("excludes group-only system pages from bank nav", () => {
    const system = BANK_INTERNAL_NAV_GROUPS.find((group) => group.id === "system");
    const paths = system?.links.map((link) => link.to) ?? [];
    assert.equal(paths.includes("/internal/settings"), false);
    assert.equal(paths.includes("/internal/compliance"), false);
    assert.ok(paths.includes("/internal/bank/settings"));
    assert.ok(paths.includes("/internal/jobs"));
  });
});
