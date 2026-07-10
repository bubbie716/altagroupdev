import { createFileRoute } from "@tanstack/react-router";
import {
  buildSetCookie,
  getSessionCookieName,
  loginErrorRedirect,
  redirectWithSetCookies,
  sessionMaxAgeSec,
} from "@/server/session";
import { unsealJson } from "@/server/crypto";
import {
  exchangeDiscordCode,
  fetchDiscordProfile,
  getDiscordConfig,
  isAllowedReturnOrigin,
  parseRedirectUriListForOAuth,
  resolveDiscordRedirectUri,
} from "@/server/discord";
import { loginWithDiscordProfile } from "@/server/auth.service";
import { isDatabaseConfigured } from "@/server/db";
import { resolveSiteContextFromRequest } from "@/lib/site/site-context";
import { createSessionHandoff, hostsMatch } from "@/server/session-handoff";
import { clearOAuthStateCookie, validateOAuthStateCookie } from "@/server/oauth-state";
import { enforceRateLimit } from "@/server/rate-limit.service";

export const Route = createFileRoute("/api/auth/discord/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limited = await enforceRateLimit(request, "oauth-callback", 30, 60_000);
        if (limited) return limited;

        const config = getDiscordConfig();
        if (!config) {
          return loginErrorRedirect(request, "oauth_not_configured");
        }

        if (!isDatabaseConfigured()) {
          return loginErrorRedirect(request, "database_not_configured");
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const stateParam = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error || !code || !stateParam) {
          return loginErrorRedirect(request, "oauth_denied");
        }

        const parsed = await unsealJson<{
          returnTo: string;
          returnOrigin?: string;
          nonce?: string;
        }>(stateParam);
        if (!parsed?.returnTo) {
          return loginErrorRedirect(request, "invalid_state");
        }

        if (!validateOAuthStateCookie(request, parsed.nonce)) {
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

        const site = resolveSiteContextFromRequest(
          Object.fromEntries(url.searchParams),
          url.pathname,
        );
        const allowed = parseRedirectUriListForOAuth();
        const returnOrigin =
          parsed.returnOrigin && isAllowedReturnOrigin(parsed.returnOrigin, allowed)
            ? parsed.returnOrigin
            : url.origin;
        const safePath =
          parsed.returnTo.startsWith("/") && !parsed.returnTo.startsWith("//")
            ? parsed.returnTo
            : site.defaultAuthenticatedRoute;

        const callbackHost = new URL(url.origin).hostname;
        const returnHost = new URL(returnOrigin).hostname;

        const clearState = clearOAuthStateCookie(url.host);

        if (hostsMatch(callbackHost, returnHost)) {
          const destination = new URL(safePath, url.origin).toString();
          return redirectWithSetCookies(destination, [
            buildSetCookie(
              getSessionCookieName(),
              auth.sessionToken,
              sessionMaxAgeSec(),
              url.host,
            ),
            clearState,
          ]);
        }

        const handoffId = await createSessionHandoff(auth.sessionToken);
        if (!handoffId) {
          return loginErrorRedirect(request, "session_not_configured");
        }

        const handoffUrl = new URL("/api/auth/session/handoff", returnOrigin);
        handoffUrl.searchParams.set("handoff", handoffId);
        handoffUrl.searchParams.set("redirect", safePath);

        return redirectWithSetCookies(handoffUrl.toString(), [clearState]);
      },
    },
  },
});
