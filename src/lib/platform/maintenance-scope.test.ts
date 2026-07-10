import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMaintenanceScopeForSite,
  isMaintenanceActiveForSite,
  maintenanceScopesForInternalSettings,
} from "@/lib/platform/maintenance-types";

const flags = {
  sitewide: false,
  corporate: false,
  bank: false,
  exchange: false,
  terminal: false,
};

describe("maintenance scope routing", () => {
  it("applies sitewide maintenance to every Alta site except NCC", () => {
    const active = { ...flags, sitewide: true };
    assert.equal(isMaintenanceActiveForSite("corporate", active), true);
    assert.equal(isMaintenanceActiveForSite("bank", active), true);
    assert.equal(isMaintenanceActiveForSite("exchange", active), true);
    assert.equal(isMaintenanceActiveForSite("terminal", active), true);
    assert.equal(isMaintenanceActiveForSite("ncc", active), false);
  });

  it("does not apply Alta scoped maintenance to NCC", () => {
    assert.equal(isMaintenanceActiveForSite("ncc", { ...flags, corporate: true }), false);
    assert.equal(isMaintenanceActiveForSite("ncc", { ...flags, bank: true }), false);
    assert.equal(isMaintenanceActiveForSite("ncc", { ...flags, exchange: true }), false);
    assert.equal(isMaintenanceActiveForSite("ncc", { ...flags, terminal: true }), false);
  });

  it("applies scoped maintenance only to matching sites", () => {
    assert.equal(isMaintenanceActiveForSite("bank", { ...flags, bank: true }), true);
    assert.equal(isMaintenanceActiveForSite("corporate", { ...flags, bank: true }), false);
    assert.equal(isMaintenanceActiveForSite("exchange", { ...flags, exchange: true }), true);
    assert.equal(isMaintenanceActiveForSite("terminal", { ...flags, terminal: true }), true);
    assert.equal(isMaintenanceActiveForSite("exchange", { ...flags, terminal: true }), false);
    assert.equal(isMaintenanceActiveForSite("bank", { ...flags, terminal: true }), false);
    assert.equal(isMaintenanceActiveForSite("corporate", { ...flags, corporate: true }), true);
  });

  it("labels the effective scope for a site", () => {
    assert.equal(getMaintenanceScopeForSite("bank", { ...flags, sitewide: true }), "sitewide");
    assert.equal(getMaintenanceScopeForSite("bank", { ...flags, bank: true }), "bank");
    assert.equal(getMaintenanceScopeForSite("exchange", { ...flags, exchange: true }), "exchange");
    assert.equal(getMaintenanceScopeForSite("terminal", { ...flags, terminal: true }), "terminal");
  });

  it("maps each internal settings page to its own maintenance scopes", () => {
    assert.deepEqual(maintenanceScopesForInternalSettings("corporate"), ["sitewide", "corporate"]);
    assert.deepEqual(maintenanceScopesForInternalSettings("bank"), ["bank"]);
    assert.deepEqual(maintenanceScopesForInternalSettings("exchange"), ["exchange"]);
    assert.deepEqual(maintenanceScopesForInternalSettings("terminal"), ["terminal"]);
    assert.deepEqual(maintenanceScopesForInternalSettings("ncc"), []);
  });
});
