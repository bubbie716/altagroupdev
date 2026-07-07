import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { resolveOAuthCallbackUri, resolveOAuthReturnUrl } from "@/server/discord";

const ORIGINAL_ENV = { ...process.env };

describe("resolveOAuthCallbackUri", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      DISCORD_CLIENT_ID: "client",
      DISCORD_CLIENT_SECRET: "secret",
      DISCORD_REDIRECT_URI:
        "https://altagroup.dev/api/auth/discord/callback,https://newportclearingcorporation.com/api/auth/discord/callback",
      NODE_ENV: "production",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns the callback when origin is registered in production", () => {
    assert.equal(
      resolveOAuthCallbackUri("https://newportclearingcorporation.com"),
      "https://newportclearingcorporation.com/api/auth/discord/callback",
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
        "https://altagroup.dev/api/auth/discord/callback,https://newportclearingcorporation.com/api/auth/discord/callback",
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
        returnOrigin: "https://newportclearingcorporation.com",
      },
      "/home",
    );
    assert.equal(url, "https://newportclearingcorporation.com/dashboard");
  });
});
