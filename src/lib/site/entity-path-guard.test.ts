import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveCrossSitePathRedirect,
  resolveEntitySubdomainRedirect,
  resolveLegacyEntityHostRedirect,
} from "@/lib/site/entity-path-guard";
import { siteKeyForOwnedPath } from "@/lib/site/site-path-ownership";

describe("siteKeyForOwnedPath", () => {
  it("marks corporate marketing paths as corporate-owned", () => {
    assert.equal(siteKeyForOwnedPath("/structure"), "corporate");
    assert.equal(siteKeyForOwnedPath("/home"), "corporate");
  });

  it("leaves shared paths unowned", () => {
    assert.equal(siteKeyForOwnedPath("/legal"), null);
    assert.equal(siteKeyForOwnedPath("/support"), null);
    assert.equal(siteKeyForOwnedPath("/"), null);
  });
});

describe("resolveCrossSitePathRedirect", () => {
  it("does not redirect owned paths on plain localhost without site override", () => {
    assert.equal(resolveCrossSitePathRedirect("/bank/open", { host: "localhost:3000" }), null);
    assert.equal(resolveCrossSitePathRedirect("/structure", { host: "localhost:3000" }), null);
  });

  it("redirects corporate paths away from entity production hosts", () => {
    assert.equal(
      resolveCrossSitePathRedirect("/structure", { host: "bank.altagroup.dev" }),
      "http://altagroup.dev/structure",
    );
    assert.equal(
      resolveCrossSitePathRedirect("/home", { host: "exchange.altagroup.dev" }),
      "http://altagroup.dev/home",
    );
  });

  it("redirects bank paths from corporate production host", () => {
    assert.equal(
      resolveCrossSitePathRedirect("/bank/open", { host: "altagroup.dev" }),
      "http://bank.altagroup.dev/bank/open",
    );
  });

  it("does not redirect when already on the owning host", () => {
    assert.equal(
      resolveCrossSitePathRedirect("/bank/open", { host: "bank.altagroup.dev" }),
      null,
    );
    assert.equal(
      resolveCrossSitePathRedirect("/terminal/trade", { host: "terminal.localhost:3000" }),
      null,
    );
    assert.equal(resolveCrossSitePathRedirect("/structure", { host: "altagroup.dev" }), null);
  });

  it("does not redirect shared paths across sites", () => {
    assert.equal(resolveCrossSitePathRedirect("/legal", { host: "bank.altagroup.dev" }), null);
    assert.equal(
      resolveCrossSitePathRedirect("/support", { host: "terminal.altagroup.dev" }),
      null,
    );
    assert.equal(
      resolveCrossSitePathRedirect("/profile", { host: "exchange.altagroup.dev" }),
      null,
    );
    assert.equal(resolveCrossSitePathRedirect("/internal", { host: "bank.altagroup.dev" }), null);
    assert.equal(
      resolveCrossSitePathRedirect("/dashboard", { host: "bank.altagroup.dev" }),
      null,
    );
    assert.equal(
      resolveCrossSitePathRedirect("/login", { host: "exchange.altagroup.dev" }),
      null,
    );
  });

  it("redirects corporate paths away from plain localhost with ?site= override", () => {
    assert.equal(
      resolveCrossSitePathRedirect("/structure", {
        host: "localhost:3000",
        search: { site: "bank" },
      }),
      "http://localhost:3000/structure",
    );
  });

  it("redirects entity paths away from plain localhost with mismatched ?site=", () => {
    assert.equal(
      resolveCrossSitePathRedirect("/bank/open", {
        host: "localhost:3000",
        search: { site: "exchange" },
      }),
      "http://localhost:3000/bank/open",
    );
  });
});

describe("resolveEntitySubdomainRedirect", () => {
  it("remains an alias for cross-site redirects", () => {
    assert.equal(
      resolveEntitySubdomainRedirect("/bank/open", { host: "altagroup.dev" }),
      "http://bank.altagroup.dev/bank/open",
    );
  });
});

describe("resolveLegacyEntityHostRedirect", () => {
  it("returns null for legacy entity host redirects", () => {
    assert.equal(
      resolveLegacyEntityHostRedirect("/company", { host: "bank.altagroup.dev" }),
      null,
    );
  });
});
