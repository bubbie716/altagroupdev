import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { siteKeyForEntityPath, siteKeyForOwnedPath } from "@/lib/site/site-path-ownership";

describe("site-path-ownership", () => {
  it("assigns entity app prefixes", () => {
    assert.equal(siteKeyForOwnedPath("/bank/deposit"), "bank");
    assert.equal(siteKeyForOwnedPath("/exchange/listings"), "exchange");
    assert.equal(siteKeyForOwnedPath("/terminal/trade"), "terminal");
  });

  it("assigns NCC ops prefixes", () => {
    assert.equal(siteKeyForOwnedPath("/institutions"), "ncc");
    assert.equal(siteKeyForOwnedPath("/company/ncc"), "ncc");
  });

  it("treats dashboard, login, admin, and markets as shared shortcuts", () => {
    assert.equal(siteKeyForOwnedPath("/dashboard"), null);
    assert.equal(siteKeyForOwnedPath("/login"), null);
    assert.equal(siteKeyForOwnedPath("/admin"), null);
    assert.equal(siteKeyForOwnedPath("/markets"), null);
  });

  it("excludes corporate paths from entity path helper", () => {
    assert.equal(siteKeyForEntityPath("/structure"), null);
    assert.equal(siteKeyForEntityPath("/bank"), "bank");
  });

  it("treats legal and support as shared", () => {
    assert.equal(siteKeyForOwnedPath("/legal/terms"), null);
    assert.equal(siteKeyForOwnedPath("/support"), null);
  });

  it("treats profile, companies, and internal as shared", () => {
    assert.equal(siteKeyForOwnedPath("/profile"), null);
    assert.equal(siteKeyForOwnedPath("/companies"), null);
    assert.equal(siteKeyForOwnedPath("/internal/bank"), null);
  });
});
