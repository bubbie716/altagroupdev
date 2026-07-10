import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSiteInternalLink } from "@/components/site/site-internal-link";

describe("resolveSiteInternalLink", () => {
  it("uses router links on the matching subdomain", () => {
    assert.deepEqual(
      resolveSiteInternalLink("bank", "/bank/open", { host: "bank.localhost:3000" }),
      { kind: "router", to: "/bank/open", search: undefined },
    );
  });

  it("uses router links on plain localhost with path-based entity routes", () => {
    assert.deepEqual(resolveSiteInternalLink("bank", "/bank/open", { host: "localhost:3000" }), {
      kind: "router",
      to: "/bank/open",
      search: undefined,
    });
  });

  it("adds ?site= on plain localhost for entity home and shared routes", () => {
    assert.deepEqual(resolveSiteInternalLink("bank", "/", { host: "localhost:3000" }), {
      kind: "router",
      to: "/",
      search: { site: "bank" },
    });
    assert.deepEqual(resolveSiteInternalLink("exchange", "/support", { host: "localhost:3000" }), {
      kind: "router",
      to: "/support",
      search: { site: "exchange" },
    });
  });

  it("uses router links for corporate on localhost", () => {
    assert.deepEqual(
      resolveSiteInternalLink("corporate", "/structure", { host: "localhost:3000" }),
      {
        kind: "router",
        to: "/structure",
        search: undefined,
      },
    );
  });

  it("uses production subdomain urls from the wrong production host", () => {
    assert.deepEqual(resolveSiteInternalLink("bank", "/bank/open", { host: "altagroup.dev" }), {
      kind: "url",
      href: "http://bank.altagroup.dev/bank/open",
    });
  });
});
