import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAccountMenuItems } from "@/lib/account/account-menu-config";

describe("account-menu-config", () => {
  it("includes profile and companies on every site", () => {
    for (const siteKey of ["corporate", "bank", "exchange", "terminal"] as const) {
      const items = getAccountMenuItems(siteKey, { showInternal: false });
      assert.deepEqual(
        items.map((item) => item.to),
        ["/profile", "/companies"],
      );
    }
  });

  it("labels internal menu by site", () => {
    assert.equal(getAccountMenuItems("corporate", { showInternal: true }).at(-1)?.label, "Internal");
    assert.equal(
      getAccountMenuItems("bank", { showInternal: true }).at(-1)?.label,
      "Bank Internal",
    );
    assert.equal(
      getAccountMenuItems("exchange", { showInternal: true }).at(-1)?.label,
      "Terminal Internal",
    );
  });

  it("omits internal link for NCC and when access is denied", () => {
    assert.deepEqual(
      getAccountMenuItems("ncc", { showInternal: true }).map((item) => item.to),
      ["/profile", "/companies"],
    );
    assert.deepEqual(
      getAccountMenuItems("bank", { showInternal: false }).map((item) => item.to),
      ["/profile", "/companies"],
    );
  });
});
