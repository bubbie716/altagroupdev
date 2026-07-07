import { describe, expect, it } from "vitest";
import { siteKeyForEntityPath, siteKeyForOwnedPath } from "@/lib/site/site-path-ownership";

describe("site-path-ownership", () => {
  it("assigns entity app prefixes", () => {
    expect(siteKeyForOwnedPath("/bank/deposit")).toBe("bank");
    expect(siteKeyForOwnedPath("/exchange/listings")).toBe("exchange");
    expect(siteKeyForOwnedPath("/terminal/trade")).toBe("terminal");
  });

  it("assigns NCC ops prefixes", () => {
    expect(siteKeyForOwnedPath("/dashboard")).toBe("ncc");
    expect(siteKeyForOwnedPath("/login")).toBe("ncc");
    expect(siteKeyForOwnedPath("/company/ncc")).toBe("ncc");
  });

  it("excludes corporate paths from entity path helper", () => {
    expect(siteKeyForEntityPath("/structure")).toBeNull();
    expect(siteKeyForEntityPath("/bank")).toBe("bank");
  });

  it("treats legal and support as shared", () => {
    expect(siteKeyForOwnedPath("/legal/terms")).toBeNull();
    expect(siteKeyForOwnedPath("/support")).toBeNull();
  });
});
