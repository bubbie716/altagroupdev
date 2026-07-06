import { describe, expect, it } from "vitest";
import { resolveSiteInternalLink } from "@/components/site/site-internal-link";

describe("resolveSiteInternalLink", () => {
  it("uses router links on the matching subdomain", () => {
    expect(
      resolveSiteInternalLink("bank", "/bank/open", { host: "bank.localhost:3000" }),
    ).toEqual({ kind: "router", to: "/bank/open", search: undefined });
  });

  it("uses router links on plain localhost with path-based entity routes", () => {
    expect(resolveSiteInternalLink("bank", "/bank/open", { host: "localhost:3000" })).toEqual({
      kind: "router",
      to: "/bank/open",
      search: undefined,
    });
  });

  it("adds ?site= on plain localhost for entity home and shared routes", () => {
    expect(resolveSiteInternalLink("bank", "/", { host: "localhost:3000" })).toEqual({
      kind: "router",
      to: "/",
      search: { site: "bank" },
    });
    expect(resolveSiteInternalLink("exchange", "/support", { host: "localhost:3000" })).toEqual({
      kind: "router",
      to: "/support",
      search: { site: "exchange" },
    });
  });

  it("uses router links for corporate on localhost", () => {
    expect(resolveSiteInternalLink("corporate", "/structure", { host: "localhost:3000" })).toEqual({
      kind: "router",
      to: "/structure",
      search: undefined,
    });
  });

  it("uses production subdomain urls from the wrong production host", () => {
    expect(resolveSiteInternalLink("bank", "/bank/open", { host: "altagroup.dev" })).toEqual({
      kind: "url",
      href: "http://bank.altagroup.dev/bank/open",
    });
  });
});
