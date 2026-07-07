import { describe, expect, it } from "vitest";
import {
  assertEntityInternalRouteAccess,
  internalHomePathForSite,
} from "@/lib/internal/entity-internal-scope";

describe("entity-internal-scope", () => {
  it("maps internal home paths by site", () => {
    expect(internalHomePathForSite("corporate")).toBe("/internal");
    expect(internalHomePathForSite("bank")).toBe("/internal/bank");
    expect(internalHomePathForSite("exchange")).toBe("/internal");
  });

  it("allows corporate and bank routes without redirect", () => {
    expect(() => assertEntityInternalRouteAccess("corporate", "/internal/settings")).not.toThrow();
    expect(() => assertEntityInternalRouteAccess("bank", "/internal/bank/accounts")).not.toThrow();
  });
});
