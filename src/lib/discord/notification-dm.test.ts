import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULT_ALTA_WEB_BASE_URL,
  resolveAltaWebBaseUrl,
  resolvePublicLinkUrl,
} from "./notification-dm.ts";

describe("resolvePublicLinkUrl", () => {
  const originalBaseUrl = process.env.ALTA_WEB_BASE_URL;

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.ALTA_WEB_BASE_URL;
    else process.env.ALTA_WEB_BASE_URL = originalBaseUrl;
  });

  it("defaults Discord notification links to altagroup.dev", () => {
    delete process.env.ALTA_WEB_BASE_URL;
    assert.equal(resolveAltaWebBaseUrl(), DEFAULT_ALTA_WEB_BASE_URL);
    assert.equal(resolvePublicLinkUrl("/bank/pay"), "https://altagroup.dev/bank/pay");
  });

  it("respects ALTA_WEB_BASE_URL override for local development", () => {
    process.env.ALTA_WEB_BASE_URL = "http://localhost:3000/";
    assert.equal(resolvePublicLinkUrl("/bank/invoices"), "http://localhost:3000/bank/invoices");
  });

  it("passes through absolute URLs unchanged", () => {
    assert.equal(resolvePublicLinkUrl("https://discord.com/channels/1/2"), "https://discord.com/channels/1/2");
  });
});
