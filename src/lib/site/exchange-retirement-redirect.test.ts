import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  EXCHANGE_HOST_VERCEL_DESTINATION,
  isRetiredExchangeHost,
  isRetiredExchangeProductPath,
  resolveRetiredExchangeRedirect,
  RETIRED_EXCHANGE_TERMINAL_PATH,
} from "@/lib/site/exchange-retirement-redirect";
import { resolveCrossSitePathRedirect } from "@/lib/site/entity-path-guard";
import { siteKeyForOwnedPath } from "@/lib/site/site-path-ownership";

describe("Sprint 4G.1 Exchange retirement redirects", () => {
  it("treats Exchange production and local hosts as retired", () => {
    assert.equal(isRetiredExchangeHost("exchange.altagroup.dev"), true);
    assert.equal(isRetiredExchangeHost("exchange.localhost:3000"), true);
    assert.equal(isRetiredExchangeHost("terminal.altagroup.dev"), false);
    assert.equal(isRetiredExchangeHost("altagroup.dev"), false);
  });

  it("recognizes /exchange product paths but not /internal/exchange", () => {
    assert.equal(isRetiredExchangeProductPath("/"), false);
    assert.equal(isRetiredExchangeProductPath("/exchange"), true);
    assert.equal(isRetiredExchangeProductPath("/exchange/listings"), true);
    assert.equal(isRetiredExchangeProductPath("/exchange/company/ABC"), true);
    assert.equal(isRetiredExchangeProductPath("/internal/exchange"), false);
    assert.equal(isRetiredExchangeProductPath("/internal/exchange/settings"), false);
  });

  it("redirects Exchange host / to Terminal /terminal", () => {
    const href = resolveRetiredExchangeRedirect("/", { host: "exchange.altagroup.dev" });
    assert.ok(href);
    const url = new URL(href);
    assert.equal(url.hostname, "terminal.altagroup.dev");
    assert.equal(url.pathname, RETIRED_EXCHANGE_TERMINAL_PATH);
  });

  it("redirects Exchange host /listings without preserving the path", () => {
    const href = resolveRetiredExchangeRedirect("/listings", { host: "exchange.altagroup.dev" });
    assert.ok(href);
    const url = new URL(href);
    assert.equal(url.hostname, "terminal.altagroup.dev");
    assert.equal(url.pathname, RETIRED_EXCHANGE_TERMINAL_PATH);
    assert.equal(url.pathname.includes("listings"), false);
  });

  it("redirects Exchange host /exchange/listings without preserving Exchange pathname", () => {
    const href = resolveRetiredExchangeRedirect("/exchange/listings", {
      host: "exchange.altagroup.dev",
      searchStr: "?ref=legacy",
    });
    assert.ok(href);
    assert.equal(new URL(href).pathname, RETIRED_EXCHANGE_TERMINAL_PATH);
    assert.equal(new URL(href).hostname, "terminal.altagroup.dev");
    assert.equal(new URL(href).searchParams.get("ref"), "legacy");
    assert.equal(new URL(href).pathname.includes("exchange"), false);
  });

  it("redirects Exchange host /exchange/company/ABC to Terminal /terminal", () => {
    const href = resolveRetiredExchangeRedirect("/exchange/company/ABC", {
      host: "exchange.altagroup.dev",
    });
    assert.ok(href);
    const url = new URL(href);
    assert.equal(url.hostname, "terminal.altagroup.dev");
    assert.equal(url.pathname, RETIRED_EXCHANGE_TERMINAL_PATH);
  });

  it("redirects corporate host /exchange to Terminal /terminal", () => {
    const href = resolveRetiredExchangeRedirect("/exchange", { host: "altagroup.dev" });
    assert.ok(href);
    const url = new URL(href);
    assert.equal(url.hostname, "terminal.altagroup.dev");
    assert.equal(url.pathname, RETIRED_EXCHANGE_TERMINAL_PATH);
  });

  it("redirects corporate host /exchange/ipo to Terminal /terminal", () => {
    const href = resolveRetiredExchangeRedirect("/exchange/ipo", { host: "altagroup.dev" });
    assert.ok(href);
    const url = new URL(href);
    assert.equal(url.hostname, "terminal.altagroup.dev");
    assert.equal(url.pathname, RETIRED_EXCHANGE_TERMINAL_PATH);
  });

  it("keeps local-dev Exchange host redirects on exchange.localhost", () => {
    assert.equal(
      resolveRetiredExchangeRedirect("/exchange/listings", {
        host: "exchange.localhost:3000",
      }),
      "http://terminal.localhost:3000/terminal",
    );
  });

  it("does not create a cross-site bounce back to the Exchange host", () => {
    // /exchange is no longer owned by the exchange site for cross-host routing.
    assert.equal(siteKeyForOwnedPath("/exchange/listings"), null);
    assert.equal(
      resolveCrossSitePathRedirect("/exchange/listings", {
        host: "terminal.altagroup.dev",
      }),
      null,
    );
    // Retirement redirect still sends product paths to Terminal /terminal.
    const href = resolveRetiredExchangeRedirect("/exchange/listings", {
      host: "terminal.altagroup.dev",
    });
    assert.ok(href);
    const url = new URL(href);
    assert.equal(url.hostname, "terminal.altagroup.dev");
    assert.equal(url.pathname, RETIRED_EXCHANGE_TERMINAL_PATH);
  });

  it("configures Vercel Exchange host destination to Terminal /terminal only", () => {
    const vercel = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
    const parsed = JSON.parse(vercel) as {
      redirects: Array<{ has?: Array<{ value: string }>; destination: string }>;
    };
    const exchangeRedirect = parsed.redirects.find((row) =>
      row.has?.some((h) => h.value === "exchange.altagroup.dev"),
    );
    assert.ok(exchangeRedirect);
    assert.equal(exchangeRedirect.destination, EXCHANGE_HOST_VERCEL_DESTINATION);
    assert.equal(exchangeRedirect.destination.includes(":path"), false);
  });
});
