import { describe, expect, it } from "vitest";
import { resolveSiteKey, resolveSiteKeyFromHost } from "@/lib/site/site-context";

describe("site context", () => {
  it("resolves corporate on localhost", () => {
    expect(resolveSiteKeyFromHost("localhost:3000")).toBe("corporate");
    expect(resolveSiteKeyFromHost("127.0.0.1:5173")).toBe("corporate");
  });

  it("resolves entity subdomains in production", () => {
    expect(resolveSiteKeyFromHost("bank.altagroup.dev")).toBe("bank");
    expect(resolveSiteKeyFromHost("exchange.altagroup.dev")).toBe("exchange");
    expect(resolveSiteKeyFromHost("terminal.altagroup.dev")).toBe("terminal");
    expect(resolveSiteKeyFromHost("ncc.altagroup.dev")).toBe("ncc");
    expect(resolveSiteKeyFromHost("www.altagroup.dev")).toBe("corporate");
  });

  it("resolves NCC custom production domain", () => {
    expect(resolveSiteKeyFromHost("newportclearingcorporation.com")).toBe("ncc");
    expect(resolveSiteKeyFromHost("www.newportclearingcorporation.com")).toBe("ncc");
  });

  it("resolves entity subdomains in local dev", () => {
    expect(resolveSiteKeyFromHost("bank.localhost:5173")).toBe("bank");
    expect(resolveSiteKeyFromHost("terminal.localhost:3000")).toBe("terminal");
  });

  it("allows dev query override only outside production", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    expect(resolveSiteKey({ host: "localhost:3000", search: { site: "bank" } })).toBe("bank");
    process.env.NODE_ENV = "production";
    expect(resolveSiteKey({ host: "localhost:3000", search: { site: "bank" } })).toBe("corporate");
    process.env.NODE_ENV = original;
  });

  it("resolves entity site from path on plain localhost in dev", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    expect(
      resolveSiteKey({ host: "localhost:3000", pathname: "/bank/open" }),
    ).toBe("bank");
    expect(
      resolveSiteKey({ host: "localhost:3000", pathname: "/terminal/trade" }),
    ).toBe("terminal");
    expect(
      resolveSiteKey({ host: "localhost:3000", pathname: "/company/ncc" }),
    ).toBe("ncc");
    process.env.NODE_ENV = original;
  });
});
