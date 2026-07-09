import { describe, expect, it } from "vitest";
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
    expect(isMaintenanceActiveForSite("corporate", active)).toBe(true);
    expect(isMaintenanceActiveForSite("bank", active)).toBe(true);
    expect(isMaintenanceActiveForSite("exchange", active)).toBe(true);
    expect(isMaintenanceActiveForSite("terminal", active)).toBe(true);
    expect(isMaintenanceActiveForSite("ncc", active)).toBe(false);
  });

  it("does not apply Alta scoped maintenance to NCC", () => {
    expect(isMaintenanceActiveForSite("ncc", { ...flags, corporate: true })).toBe(false);
    expect(isMaintenanceActiveForSite("ncc", { ...flags, bank: true })).toBe(false);
    expect(isMaintenanceActiveForSite("ncc", { ...flags, exchange: true })).toBe(false);
    expect(isMaintenanceActiveForSite("ncc", { ...flags, terminal: true })).toBe(false);
  });

  it("applies scoped maintenance only to matching sites", () => {
    expect(isMaintenanceActiveForSite("bank", { ...flags, bank: true })).toBe(true);
    expect(isMaintenanceActiveForSite("corporate", { ...flags, bank: true })).toBe(false);
    expect(isMaintenanceActiveForSite("exchange", { ...flags, exchange: true })).toBe(true);
    expect(isMaintenanceActiveForSite("terminal", { ...flags, terminal: true })).toBe(true);
    expect(isMaintenanceActiveForSite("exchange", { ...flags, terminal: true })).toBe(false);
    expect(isMaintenanceActiveForSite("bank", { ...flags, terminal: true })).toBe(false);
    expect(isMaintenanceActiveForSite("corporate", { ...flags, corporate: true })).toBe(true);
  });

  it("labels the effective scope for a site", () => {
    expect(getMaintenanceScopeForSite("bank", { ...flags, sitewide: true })).toBe("sitewide");
    expect(getMaintenanceScopeForSite("bank", { ...flags, bank: true })).toBe("bank");
    expect(getMaintenanceScopeForSite("exchange", { ...flags, exchange: true })).toBe("exchange");
    expect(getMaintenanceScopeForSite("terminal", { ...flags, terminal: true })).toBe("terminal");
  });

  it("maps each internal settings page to its own maintenance scopes", () => {
    expect(maintenanceScopesForInternalSettings("corporate")).toEqual(["sitewide", "corporate"]);
    expect(maintenanceScopesForInternalSettings("bank")).toEqual(["bank"]);
    expect(maintenanceScopesForInternalSettings("exchange")).toEqual(["exchange"]);
    expect(maintenanceScopesForInternalSettings("terminal")).toEqual(["terminal"]);
    expect(maintenanceScopesForInternalSettings("ncc")).toEqual([]);
  });
});
