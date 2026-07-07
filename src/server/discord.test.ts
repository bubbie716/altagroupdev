import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { resolveDiscordRedirectUri, resolveOAuthReturnUrl } from "@/server/discord";

const ORIGINAL_ENV = { ...process.env };

describe("resolveDiscordRedirectUri", () => {
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

  it("uses the request origin callback when registered in production", () => {
    const request = new Request("https://newportclearingcorporation.com/api/auth/discord");
    assert.equal(
      resolveDiscordRedirectUri(request),
      "https://newportclearingcorporation.com/api/auth/discord/callback",
    );
  });

  it("falls back to the first allowed callback when origin is unknown", () => {
    const request = new Request("https://unknown.example.com/api/auth/discord");
    assert.equal(
      resolveDiscordRedirectUri(request),
      "https://altagroup.dev/api/auth/discord/callback",
    );
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
