import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSiteKey, resolveSiteKeyFromHost } from "@/lib/site/site-context";

describe("site context", () => {
  it("resolves corporate on localhost", () => {
    assert.equal(resolveSiteKeyFromHost("localhost:3000"), "corporate");
    assert.equal(resolveSiteKeyFromHost("127.0.0.1:5173"), "corporate");
  });

  it("resolves entity subdomains in production", () => {
    assert.equal(resolveSiteKeyFromHost("bank.altagroup.dev"), "bank");
    assert.equal(resolveSiteKeyFromHost("exchange.altagroup.dev"), "exchange");
    assert.equal(resolveSiteKeyFromHost("terminal.altagroup.dev"), "terminal");
    assert.equal(resolveSiteKeyFromHost("www.altagroup.dev"), "corporate");
  });

  it("resolves entity subdomains in local dev", () => {
    assert.equal(resolveSiteKeyFromHost("bank.localhost:5173"), "bank");
    assert.equal(resolveSiteKeyFromHost("terminal.localhost:3000"), "terminal");
  });

  it("allows dev query override only outside production", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    assert.equal(resolveSiteKey({ host: "localhost:3000", search: { site: "bank" } }), "bank");
    process.env.NODE_ENV = "production";
    assert.equal(resolveSiteKey({ host: "localhost:3000", search: { site: "bank" } }), "corporate");
    process.env.NODE_ENV = original;
  });

  it("resolves entity site from path on plain localhost in dev", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    assert.equal(resolveSiteKey({ host: "localhost:3000", pathname: "/bank/open" }), "bank");
    assert.equal(resolveSiteKey({ host: "localhost:3000", pathname: "/terminal/trade" }), "terminal");
    process.env.NODE_ENV = original;
  });
});
