import { describe, expect, it } from "vitest";
import { resolveEntitySubdomainRedirect } from "@/lib/site/entity-path-guard";

describe("resolveEntitySubdomainRedirect", () => {
  it("does not redirect on plain localhost in dev", () => {
    expect(
      resolveEntitySubdomainRedirect("/bank/open", { host: "localhost:3000" }),
    ).toBeNull();
    expect(
      resolveEntitySubdomainRedirect("/exchange/listings", { host: "localhost:3000" }),
    ).toBeNull();
  });

  it("redirects bank paths from corporate production host", () => {
    expect(
      resolveEntitySubdomainRedirect("/bank/open", { host: "altagroup.dev" }),
    ).toBe("http://bank.altagroup.dev/bank/open");
  });

  it("does not redirect when already on the entity subdomain", () => {
    expect(
      resolveEntitySubdomainRedirect("/bank/open", { host: "bank.altagroup.dev" }),
    ).toBeNull();
    expect(
      resolveEntitySubdomainRedirect("/terminal/trade", { host: "terminal.localhost:3000" }),
    ).toBeNull();
  });

  it("does not redirect corporate paths", () => {
    expect(resolveEntitySubdomainRedirect("/structure", { host: "localhost:3000" })).toBeNull();
    expect(resolveEntitySubdomainRedirect("/legal", { host: "localhost:3000" })).toBeNull();
  });
});
