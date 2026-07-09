import { describe, expect, it } from "vitest";
import { siteKeyForEntityPath, siteKeyForOwnedPath } from "@/lib/site/site-path-ownership";

describe("site-path-ownership", () => {
  it("assigns entity app prefixes", () => {
    expect(siteKeyForOwnedPath("/bank/deposit")).toBe("bank");
    expect(siteKeyForOwnedPath("/exchange/listings")).toBe("exchange");
    expect(siteKeyForOwnedPath("/terminal/trade")).toBe("terminal");
  });

  it("assigns NCC ops prefixes", () => {
    expect(siteKeyForOwnedPath("/institutions")).toBe("ncc");
    expect(siteKeyForOwnedPath("/company/ncc")).toBe("ncc");
  });

  it("treats dashboard, login, admin, and markets as shared shortcuts", () => {
    expect(siteKeyForOwnedPath("/dashboard")).toBeNull();
    expect(siteKeyForOwnedPath("/login")).toBeNull();
    expect(siteKeyForOwnedPath("/admin")).toBeNull();
    expect(siteKeyForOwnedPath("/markets")).toBeNull();
  });

  it("excludes corporate paths from entity path helper", () => {
    expect(siteKeyForEntityPath("/structure")).toBeNull();
    expect(siteKeyForEntityPath("/bank")).toBe("bank");
  });

  it("treats legal and support as shared", () => {
    expect(siteKeyForOwnedPath("/legal/terms")).toBeNull();
    expect(siteKeyForOwnedPath("/support")).toBeNull();
  });

  it("treats profile, companies, and internal as shared", () => {
    expect(siteKeyForOwnedPath("/profile")).toBeNull();
    expect(siteKeyForOwnedPath("/companies")).toBeNull();
    expect(siteKeyForOwnedPath("/internal/bank")).toBeNull();
  });
});
