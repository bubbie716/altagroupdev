import { describe, expect, it } from "vitest";
import {
  BANK_INTERNAL_NAV_GROUPS,
  getInternalNavGroupsForSite,
  INTERNAL_NAV_GROUPS,
} from "@/components/internal/console/internal-nav-config";

describe("internal-nav-config", () => {
  it("returns full nav for corporate and bank-scoped nav for bank", () => {
    expect(getInternalNavGroupsForSite("corporate")).toBe(INTERNAL_NAV_GROUPS);
    expect(getInternalNavGroupsForSite("bank")).toBe(BANK_INTERNAL_NAV_GROUPS);
    expect(getInternalNavGroupsForSite("exchange")).toBeNull();
  });

  it("points bank dashboard to bank ops home", () => {
    const dashboard = BANK_INTERNAL_NAV_GROUPS.find((group) => group.id === "dashboard");
    expect(dashboard?.links[0]?.to).toBe("/internal/bank");
  });

  it("excludes group-only system pages from bank nav", () => {
    const system = BANK_INTERNAL_NAV_GROUPS.find((group) => group.id === "system");
    const paths = system?.links.map((link) => link.to) ?? [];
    expect(paths).not.toContain("/internal/settings");
    expect(paths).not.toContain("/internal/compliance");
    expect(paths).toContain("/internal/bank/settings");
    expect(paths).toContain("/internal/jobs");
  });
});
