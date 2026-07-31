import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveInternalRouteTitle } from "@/lib/internal/internal-route-title";

describe("resolveInternalRouteTitle", () => {
  it("returns deterministic titles for required cold-load routes", () => {
    assert.equal(resolveInternalRouteTitle("/internal/bank"), "Home");
    assert.equal(resolveInternalRouteTitle("/internal/bank?site=bank"), "Home");
    assert.equal(resolveInternalRouteTitle("/internal"), "Home");
    assert.equal(resolveInternalRouteTitle("/internal/users/ui-lab-user"), "Customer");
    assert.equal(resolveInternalRouteTitle("/internal/alta-card/AC-LAB-GOLD"), "Alta Card");
    assert.equal(
      resolveInternalRouteTitle("/internal/lending/applications/cms2du8ng0001uktso2loiikt"),
      "Lending Application",
    );
    assert.equal(
      resolveInternalRouteTitle("/internal/terminal/portfolios/tp_ui-lab-user_core"),
      "Portfolio",
    );
  });

  it("does not inherit titles across independent pathnames", () => {
    const card = resolveInternalRouteTitle("/internal/alta-card/AC-LAB-GOLD");
    const lending = resolveInternalRouteTitle(
      "/internal/lending/applications/cms2du8ng0001uktso2loiikt",
    );
    const customer = resolveInternalRouteTitle("/internal/users/ui-lab-user");
    assert.equal(card, "Alta Card");
    assert.equal(lending, "Lending Application");
    assert.equal(customer, "Customer");
    assert.notEqual(card, lending);
    assert.notEqual(customer, lending);
  });

  it("never returns empty or the generic Internal placeholder", () => {
    const paths = [
      "/internal/bank",
      "/internal/inbox",
      "/internal/users/x",
      "/internal/companies/y",
      "/internal/lending/loans/LN-1",
      "/internal/terminal/orders/o1",
      "/internal/jobs",
    ];
    for (const path of paths) {
      const title = resolveInternalRouteTitle(path);
      assert.ok(title.trim().length > 0, path);
      assert.notEqual(title, "Internal");
      assert.notEqual(title, "\u00a0");
    }
  });

  it("is pure — identical for the same pathname across calls", () => {
    const path = "/internal/users/ui-lab-user";
    assert.equal(resolveInternalRouteTitle(path), resolveInternalRouteTitle(path));
  });
});
