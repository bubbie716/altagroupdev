import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSiteShortcutPath,
  resolveLegacyDashboardPath,
  resolveLegacyMarketsPath,
} from "@/lib/site/site-shortcut-routes";

describe("site-shortcut-routes", () => {
  it("recognizes shortcut paths", () => {
    assert.equal(isSiteShortcutPath("/dashboard"), true);
    assert.equal(isSiteShortcutPath("/login"), true);
    assert.equal(isSiteShortcutPath("/bank"), false);
  });

  it("maps dashboard shortcuts per site", () => {
    assert.equal(resolveLegacyDashboardPath("corporate"), "/home");
    assert.equal(resolveLegacyDashboardPath("bank"), "/bank");
    assert.equal(resolveLegacyDashboardPath("exchange"), "/exchange");
    assert.equal(resolveLegacyDashboardPath("terminal"), "/terminal");
    assert.equal(resolveLegacyDashboardPath("ncc"), "/portal");
  });

  it("maps markets shortcuts per site", () => {
    assert.equal(resolveLegacyMarketsPath("terminal"), "/terminal");
    assert.equal(resolveLegacyMarketsPath("exchange"), "/exchange");
    assert.equal(resolveLegacyMarketsPath("bank"), "/exchange");
  });
});
