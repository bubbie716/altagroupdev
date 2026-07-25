import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveEntitySiteHostname,
  resolveEntitySiteUrl,
  resolveRelativeEntitySiteUrl,
} from "@/lib/site/entity-site-url";

describe("entity site urls", () => {
  it("resolves production hostnames", () => {
    assert.equal(resolveEntitySiteHostname("bank"), "bank.altagroup.dev");
    assert.equal(resolveEntitySiteHostname("corporate"), "altagroup.dev");
  });

  it("preserves localhost port from the request host", () => {
    assert.equal(
      resolveEntitySiteUrl("bank", "/", "localhost:3000"),
      "http://localhost:3000/?site=bank",
    );
    assert.equal(
      resolveEntitySiteUrl("corporate", "/home", "localhost:3000"),
      "http://localhost:3000/home",
    );
    assert.equal(
      resolveEntitySiteUrl("bank", "/", "localhost:5173"),
      "http://localhost:5173/?site=bank",
    );
  });

  it("resolves plain localhost entity paths without ?site=", () => {
    assert.equal(
      resolveEntitySiteUrl("bank", "/bank/open", "localhost:3000"),
      "http://localhost:3000/bank/open",
    );
    assert.equal(
      resolveEntitySiteUrl("exchange", "/exchange/listings", "localhost:3000"),
      "http://localhost:3000/exchange/listings?site=exchange",
    );
  });

  it("resolves *.localhost subsidiary urls when subdomains work", () => {
    assert.equal(
      resolveEntitySiteUrl("bank", "/bank/open", "bank.localhost:5173"),
      "http://bank.localhost:5173/bank/open",
    );
  });

  it("resolves production subsidiary urls from a production request host", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.equal(
        resolveEntitySiteUrl("exchange", "/", "altagroup.dev"),
        "https://exchange.altagroup.dev/",
      );
      assert.equal(
        resolveEntitySiteUrl("terminal", "/", "terminal.altagroup.dev"),
        "https://terminal.altagroup.dev/",
      );
      assert.equal(
        resolveEntitySiteUrl("corporate", "/home", "localhost:3000"),
        "http://localhost:3000/home",
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("uses stable relative urls when request host is missing in development", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      assert.equal(resolveEntitySiteUrl("corporate", "/home"), "/home");
      assert.equal(resolveEntitySiteUrl("bank"), "/?site=bank");
      assert.equal(resolveRelativeEntitySiteUrl("terminal", "/terminal"), "/terminal");
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("ssr and browser agree when given the same request host", () => {
    const host = "localhost:3000";
    assert.equal(
      resolveEntitySiteUrl("corporate", "/home", host),
      resolveEntitySiteUrl("corporate", "/home", host),
    );
    assert.equal(
      resolveEntitySiteUrl("bank", "/", host),
      resolveEntitySiteUrl("bank", "/", host),
    );
  });
});
