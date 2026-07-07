import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveEntitySiteHostname, resolveEntitySiteUrl } from "@/lib/site/entity-site-url";

describe("entity site urls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves production hostnames", () => {
    expect(resolveEntitySiteHostname("bank")).toBe("bank.altagroup.dev");
    expect(resolveEntitySiteHostname("corporate")).toBe("altagroup.dev");
    expect(resolveEntitySiteHostname("ncc")).toBe("newportclearingcorporation.com");
  });

  it("resolves plain localhost entity home with ?site=", () => {
    vi.stubGlobal("window", {
      location: { hostname: "localhost", port: "3000", protocol: "http:" },
    } as Window);

    expect(resolveEntitySiteUrl("bank")).toBe("http://localhost:3000/?site=bank");
    expect(resolveEntitySiteUrl("corporate", "/structure")).toBe("http://localhost:3000/structure");
  });

  it("resolves plain localhost entity paths without ?site=", () => {
    vi.stubGlobal("window", {
      location: { hostname: "localhost", port: "3000", protocol: "http:" },
    } as Window);

    expect(resolveEntitySiteUrl("bank", "/bank/open")).toBe("http://localhost:3000/bank/open");
    expect(resolveEntitySiteUrl("exchange", "/exchange/listings")).toBe(
      "http://localhost:3000/exchange/listings",
    );
  });

  it("resolves *.localhost subsidiary urls when subdomains work", () => {
    vi.stubGlobal("window", {
      location: { hostname: "localhost", port: "5173", protocol: "http:" },
    } as Window);

    expect(resolveEntitySiteUrl("bank", "/bank/open", "bank.localhost:5173")).toBe(
      "http://bank.localhost:5173/bank/open",
    );
  });

  it("resolves production subsidiary urls from altagroup.dev", () => {
    vi.stubGlobal("window", {
      location: { hostname: "altagroup.dev", port: "", protocol: "https:" },
    } as Window);

    expect(resolveEntitySiteUrl("exchange")).toBe("https://exchange.altagroup.dev/");
    expect(resolveEntitySiteUrl("terminal", "/")).toBe("https://terminal.altagroup.dev/");
    expect(resolveEntitySiteUrl("ncc", "/company/ncc")).toBe(
      "https://newportclearingcorporation.com/company/ncc",
    );
  });
});
