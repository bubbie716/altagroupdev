import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { resolveEntitySiteHostname, resolveEntitySiteUrl } from "@/lib/site/entity-site-url";

const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: Window }).window;
  } else {
    globalThis.window = originalWindow;
  }
});

function stubWindow(location: { hostname: string; port: string; protocol: string }) {
  globalThis.window = { location } as Window;
}

describe("entity site urls", () => {
  it("resolves production hostnames", () => {
    assert.equal(resolveEntitySiteHostname("bank"), "bank.altagroup.dev");
    assert.equal(resolveEntitySiteHostname("corporate"), "altagroup.dev");
  });

  it("resolves plain localhost entity home with ?site=", () => {
    stubWindow({ hostname: "localhost", port: "3000", protocol: "http:" });
    assert.equal(resolveEntitySiteUrl("bank"), "http://localhost:3000/?site=bank");
    assert.equal(resolveEntitySiteUrl("corporate", "/structure"), "http://localhost:3000/structure");
  });

  it("resolves plain localhost entity paths without ?site=", () => {
    stubWindow({ hostname: "localhost", port: "3000", protocol: "http:" });
    assert.equal(resolveEntitySiteUrl("bank", "/bank/open"), "http://localhost:3000/bank/open");
    assert.equal(
      resolveEntitySiteUrl("exchange", "/exchange/listings"),
      "http://localhost:3000/exchange/listings?site=exchange",
    );
  });

  it("resolves *.localhost subsidiary urls when subdomains work", () => {
    stubWindow({ hostname: "localhost", port: "5173", protocol: "http:" });
    assert.equal(
      resolveEntitySiteUrl("bank", "/bank/open", "bank.localhost:5173"),
      "http://bank.localhost:5173/bank/open",
    );
  });

  it("resolves production subsidiary urls from altagroup.dev", () => {
    stubWindow({ hostname: "altagroup.dev", port: "", protocol: "https:" });
    assert.equal(resolveEntitySiteUrl("exchange"), "https://exchange.altagroup.dev/");
    assert.equal(resolveEntitySiteUrl("terminal", "/"), "https://terminal.altagroup.dev/");
  });
});
