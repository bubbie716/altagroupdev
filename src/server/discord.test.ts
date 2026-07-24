import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { isAllowedReturnOrigin, resolveOAuthCallbackUri, resolveOAuthReturnUrl } from "@/server/discord";

const ORIGINAL_ENV = { ...process.env };

describe("resolveOAuthCallbackUri", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      DISCORD_CLIENT_ID: "client",
      DISCORD_CLIENT_SECRET: "secret",
      DISCORD_REDIRECT_URI:
        "https://altagroup.dev/api/auth/discord/callback,https://bank.altagroup.dev/api/auth/discord/callback",
      NODE_ENV: "production",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns the callback when origin is registered in production", () => {
    assert.equal(
      resolveOAuthCallbackUri("https://bank.altagroup.dev"),
      "https://bank.altagroup.dev/api/auth/discord/callback",
    );
  });

  it("returns null when origin is not registered", () => {
    assert.equal(resolveOAuthCallbackUri("https://unknown.example.com"), null);
  });
});

describe("resolveOAuthReturnUrl", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      DISCORD_REDIRECT_URI:
        "https://altagroup.dev/api/auth/discord/callback,https://bank.altagroup.dev/api/auth/discord/callback",
      NODE_ENV: "production",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns to the stored origin after OAuth", () => {
    const request = new Request("https://altagroup.dev/api/auth/discord/callback?code=1&state=2");
    const url = resolveOAuthReturnUrl(
      request,
      {
        returnTo: "/dashboard",
        returnOrigin: "https://bank.altagroup.dev",
      },
      "/home",
    );
    assert.equal(url, "https://bank.altagroup.dev/dashboard");
  });

  it("allows return to a known site origin when only the shared callback is registered", () => {
    process.env.DISCORD_REDIRECT_URI = "https://altagroup.dev/api/auth/discord/callback";
    assert.equal(
      isAllowedReturnOrigin("https://bank.altagroup.dev", [
        "https://altagroup.dev/api/auth/discord/callback",
      ]),
      true,
    );
  });
});
