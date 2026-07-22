import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { shouldBounceOAuthToCallbackHost } from "@/routes/api/auth/discord";
import { resolveOAuthCallbackUriForSite } from "@/server/discord";
import { buildOAuthStateCookie } from "@/server/oauth-state";

const ORIGINAL_ENV = { ...process.env };

describe("shared Discord callback bounce prerequisites", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("resolves terminal login to the shared www callback", () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      DISCORD_CLIENT_ID: "client",
      DISCORD_CLIENT_SECRET: "secret",
      DISCORD_REDIRECT_URI:
        "https://www.altagroup.dev/api/auth/discord/callback,https://newportclearingcorporation.com/api/auth/discord/callback",
    };
    assert.equal(
      resolveOAuthCallbackUriForSite("https://terminal.altagroup.dev"),
      "https://www.altagroup.dev/api/auth/discord/callback",
    );
  });

  it("sets Domain=.altagroup.dev for OAuth state cookies", () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "production" };
    delete process.env.ALTA_COOKIE_DOMAIN;
    const cookie = buildOAuthStateCookie("n", "www.altagroup.dev");
    assert.match(cookie, /Domain=\.altagroup\.dev/);
  });

  it("does not bounce www ↔ apex (avoids redirect loops)", () => {
    assert.equal(
      shouldBounceOAuthToCallbackHost("https://www.altagroup.dev", "https://altagroup.dev"),
      false,
    );
    assert.equal(
      shouldBounceOAuthToCallbackHost("https://altagroup.dev", "https://www.altagroup.dev"),
      false,
    );
    assert.equal(
      shouldBounceOAuthToCallbackHost("https://www.altagroup.dev", "https://www.altagroup.dev"),
      false,
    );
  });

  it("does bounce terminal → www shared callback", () => {
    assert.equal(
      shouldBounceOAuthToCallbackHost(
        "https://terminal.altagroup.dev",
        "https://www.altagroup.dev",
      ),
      true,
    );
  });
});
