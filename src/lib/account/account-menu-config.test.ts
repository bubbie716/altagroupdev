import { describe, expect, it } from "vitest";
import { getAccountMenuItems } from "@/lib/account/account-menu-config";

describe("account-menu-config", () => {
  it("includes profile and companies on every site", () => {
    for (const siteKey of ["corporate", "bank", "exchange", "terminal"] as const) {
      const items = getAccountMenuItems(siteKey, { showInternal: false });
      expect(items.map((item) => item.to)).toEqual(["/profile", "/companies"]);
    }
  });

  it("labels internal menu by site", () => {
    expect(getAccountMenuItems("corporate", { showInternal: true }).at(-1)?.label).toBe("Internal");
    expect(getAccountMenuItems("bank", { showInternal: true }).at(-1)?.label).toBe("Bank Internal");
    expect(getAccountMenuItems("exchange", { showInternal: true }).at(-1)?.label).toBe(
      "Exchange Internal",
    );
  });

  it("omits internal link for NCC and when access is denied", () => {
    expect(getAccountMenuItems("ncc", { showInternal: true }).map((item) => item.to)).toEqual([
      "/profile",
      "/companies",
    ]);
    expect(getAccountMenuItems("bank", { showInternal: false }).map((item) => item.to)).toEqual([
      "/profile",
      "/companies",
    ]);
  });
});
