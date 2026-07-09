import { describe, expect, it } from "vitest";
import {
  resolveCrossSitePathRedirect,
  resolveEntitySubdomainRedirect,
  resolveLegacyEntityHostRedirect,
} from "@/lib/site/entity-path-guard";
import { siteKeyForOwnedPath } from "@/lib/site/site-path-ownership";

describe("siteKeyForOwnedPath", () => {
  it("marks corporate marketing paths as corporate-owned", () => {
    expect(siteKeyForOwnedPath("/structure")).toBe("corporate");
    expect(siteKeyForOwnedPath("/home")).toBe("corporate");
  });

  it("leaves shared paths unowned", () => {
    expect(siteKeyForOwnedPath("/legal")).toBeNull();
    expect(siteKeyForOwnedPath("/support")).toBeNull();
    expect(siteKeyForOwnedPath("/")).toBeNull();
  });
});

describe("resolveCrossSitePathRedirect", () => {
  it("does not redirect owned paths on plain localhost without site override", () => {
    expect(
      resolveCrossSitePathRedirect("/bank/open", { host: "localhost:3000" }),
    ).toBeNull();
    expect(resolveCrossSitePathRedirect("/structure", { host: "localhost:3000" })).toBeNull();
  });

  it("redirects corporate paths away from entity production hosts", () => {
    expect(
      resolveCrossSitePathRedirect("/structure", { host: "bank.altagroup.dev" }),
    ).toBe("http://altagroup.dev/structure");
    expect(
      resolveCrossSitePathRedirect("/home", { host: "exchange.altagroup.dev" }),
    ).toBe("http://altagroup.dev/home");
  });

  it("redirects bank paths from corporate production host", () => {
    expect(
      resolveCrossSitePathRedirect("/bank/open", { host: "altagroup.dev" }),
    ).toBe("http://bank.altagroup.dev/bank/open");
  });

  it("does not redirect when already on the owning host", () => {
    expect(
      resolveCrossSitePathRedirect("/bank/open", { host: "bank.altagroup.dev" }),
    ).toBeNull();
    expect(
      resolveCrossSitePathRedirect("/terminal/trade", { host: "terminal.localhost:3000" }),
    ).toBeNull();
    expect(
      resolveCrossSitePathRedirect("/structure", { host: "altagroup.dev" }),
    ).toBeNull();
  });

  it("does not redirect shared paths across sites", () => {
    expect(
      resolveCrossSitePathRedirect("/legal", { host: "bank.altagroup.dev" }),
    ).toBeNull();
    expect(
      resolveCrossSitePathRedirect("/support", { host: "terminal.altagroup.dev" }),
    ).toBeNull();
    expect(
      resolveCrossSitePathRedirect("/profile", { host: "exchange.altagroup.dev" }),
    ).toBeNull();
    expect(
      resolveCrossSitePathRedirect("/internal", { host: "bank.altagroup.dev" }),
    ).toBeNull();
    expect(
      resolveCrossSitePathRedirect("/dashboard", { host: "bank.altagroup.dev" }),
    ).toBeNull();
    expect(
      resolveCrossSitePathRedirect("/login", { host: "exchange.altagroup.dev" }),
    ).toBeNull();
  });

  it("redirects NCC paths from corporate production host to NCC domain", () => {
    expect(
      resolveCrossSitePathRedirect("/company/ncc", { host: "altagroup.dev" }),
    ).toBe("http://newportclearingcorporation.com/company/ncc");
    expect(
      resolveCrossSitePathRedirect("/institutions", { host: "bank.altagroup.dev" }),
    ).toBe("http://newportclearingcorporation.com/institutions");
  });

  it("redirects corporate paths away from plain localhost with ?site= override", () => {
    expect(
      resolveCrossSitePathRedirect("/structure", {
        host: "localhost:3000",
        search: { site: "bank" },
      }),
    ).toBe("http://localhost:3000/structure");
  });

  it("redirects entity paths away from plain localhost with mismatched ?site=", () => {
    expect(
      resolveCrossSitePathRedirect("/bank/open", {
        host: "localhost:3000",
        search: { site: "exchange" },
      }),
    ).toBe("http://localhost:3000/bank/open");
  });
});

describe("resolveEntitySubdomainRedirect", () => {
  it("remains an alias for cross-site redirects", () => {
    expect(resolveEntitySubdomainRedirect("/bank/open", { host: "altagroup.dev" })).toBe(
      "http://bank.altagroup.dev/bank/open",
    );
  });
});

describe("resolveLegacyEntityHostRedirect", () => {
  it("redirects legacy NCC subdomain to canonical domain", () => {
    expect(
      resolveLegacyEntityHostRedirect("/company/ncc", { host: "ncc.altagroup.dev" }),
    ).toBe("http://newportclearingcorporation.com/company/ncc");
  });

  it("does not redirect the canonical NCC domain", () => {
    expect(
      resolveLegacyEntityHostRedirect("/company/ncc", {
        host: "newportclearingcorporation.com",
      }),
    ).toBeNull();
  });
});
