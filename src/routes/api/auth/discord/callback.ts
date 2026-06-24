import { createFileRoute } from "@tanstack/react-router";
import {
  buildClearCookie,
  buildSetCookie,
  getOAuthStateCookieName,
  getSessionCookieName,
  loginErrorRedirect,
  readCookie,
  redirectWithSetCookies,
  sessionMaxAgeSec,
} from "@/server/session";
import { unsealJson } from "@/server/crypto";
import {
  exchangeDiscordCode,
  fetchDiscordProfile,
  getDiscordConfig,
  resolveDiscordRedirectUri,
} from "@/server/discord";
import { loginWithDiscordProfile } from "@/server/auth.service";
import { isDatabaseConfigured } from "@/server/db";

export const Route = createFileRoute("/api/auth/discord/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const config = getDiscordConfig();
        if (!config) {
          return loginErrorRedirect(request, "oauth_not_configured");
        }

        if (!isDatabaseConfigured()) {
          return loginErrorRedirect(request, "database_not_configured");
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error || !code || !state) {
          return loginErrorRedirect(request, "oauth_denied");
        }

        const cookieHeader = request.headers.get("cookie");
        const stored = readCookie(getOAuthStateCookieName(), cookieHeader);
        if (!stored) {
          return loginErrorRedirect(request, "invalid_state");
        }

        const parsed = await unsealJson<{ state: string; returnTo: string }>(stored);
        if (!parsed || parsed.state !== state) {
          return loginErrorRedirect(request, "invalid_state");
        }

        const redirectUri = resolveDiscordRedirectUri(request);
        if (!redirectUri) {
          return loginErrorRedirect(request, "oauth_not_configured");
        }

        const tokenRes = await exchangeDiscordCode(code, redirectUri);
        if (!tokenRes) {
          return loginErrorRedirect(request, "token_exchange_failed");
        }

        const profile = await fetchDiscordProfile(tokenRes.access_token);
        if (!profile) {
          return loginErrorRedirect(request, "profile_fetch_failed");
        }

        const auth = await loginWithDiscordProfile(profile);
        if (!auth) {
          return loginErrorRedirect(request, "session_failed");
        }

        const safeReturn =
          parsed.returnTo.startsWith("/") && !parsed.returnTo.startsWith("//")
            ? parsed.returnTo
            : "/profile";

        return redirectWithSetCookies(new URL(safeReturn, request.url).toString(), [
          buildSetCookie(getSessionCookieName(), auth.sessionToken, sessionMaxAgeSec()),
          buildClearCookie(getOAuthStateCookieName()),
        ]);
      },
    },
  },
});
