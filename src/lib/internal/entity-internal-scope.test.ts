import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertEntityInternalRouteAccess,
  internalHomePathForSite,
} from "@/lib/internal/entity-internal-scope";

describe("entity-internal-scope", () => {
  it("maps internal home paths by site", () => {
    assert.equal(internalHomePathForSite("corporate"), "/internal");
    assert.equal(internalHomePathForSite("bank"), "/internal/bank");
    assert.equal(internalHomePathForSite("exchange"), "/internal");
    assert.equal(internalHomePathForSite("terminal"), "/internal");
  });

  it("allows corporate and bank routes without redirect", () => {
    assert.doesNotThrow(() => assertEntityInternalRouteAccess("corporate", "/internal/settings"));
    assert.doesNotThrow(() => assertEntityInternalRouteAccess("bank", "/internal/bank/accounts"));
  });

  it("allows exchange and terminal settings routes only on their own sites", () => {
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("exchange", "/internal/exchange/settings"),
    );
    assert.doesNotThrow(() =>
      assertEntityInternalRouteAccess("terminal", "/internal/terminal/settings"),
    );
  });

  it("redirects exchange/terminal away from unrelated internal routes", () => {
    assert.throws(() => assertEntityInternalRouteAccess("terminal", "/internal/settings"));
    assert.throws(() => assertEntityInternalRouteAccess("exchange", "/internal/bank"));
  });
});
