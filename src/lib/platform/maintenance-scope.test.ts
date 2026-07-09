import { describe, expect, it } from "vitest";
import {
  getMaintenanceScopeForSite,
  isMaintenanceActiveForSite,
} from "@/lib/platform/maintenance-types";

const flags = {
  sitewide: false,
  corporate: false,
  bank: false,
  markets: false,
};

describe("maintenance scope routing", () => {
  it("applies sitewide maintenance to every site", () => {
    const active = { ...flags, sitewide: true };
    expect(isMaintenanceActiveForSite("corporate", active)).toBe(true);
    expect(isMaintenanceActiveForSite("bank", active)).toBe(true);
    expect(isMaintenanceActiveForSite("exchange", active)).toBe(true);
    expect(isMaintenanceActiveForSite("terminal", active)).toBe(true);
    expect(isMaintenanceActiveForSite("ncc", active)).toBe(true);
  });

  it("applies scoped maintenance only to matching sites", () => {
    expect(isMaintenanceActiveForSite("bank", { ...flags, bank: true })).toBe(true);
    expect(isMaintenanceActiveForSite("corporate", { ...flags, bank: true })).toBe(false);
    expect(isMaintenanceActiveForSite("exchange", { ...flags, markets: true })).toBe(true);
    expect(isMaintenanceActiveForSite("terminal", { ...flags, markets: true })).toBe(true);
    expect(isMaintenanceActiveForSite("bank", { ...flags, markets: true })).toBe(false);
    expect(isMaintenanceActiveForSite("corporate", { ...flags, corporate: true })).toBe(true);
  });

  it("labels the effective scope for a site", () => {
    expect(getMaintenanceScopeForSite("bank", { ...flags, sitewide: true })).toBe("sitewide");
    expect(getMaintenanceScopeForSite("bank", { ...flags, bank: true })).toBe("bank");
    expect(getMaintenanceScopeForSite("exchange", { ...flags, markets: true })).toBe("markets");
  });
});
