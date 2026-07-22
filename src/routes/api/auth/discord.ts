import { createFileRoute } from "@tanstack/react-router";
import { normalizeOAuthOrigin } from "@/lib/site/oauth-origin";
import { sealJson } from "@/server/crypto";
import {
  buildDiscordAuthorizeUrl,
  getDiscordConfig,
  isAllowedReturnOrigin,
  parseRedirectUriListForOAuth,
  resolveOAuthCallbackUriForSite,
} from "@/server/discord";
import { resolveSiteContextFromRequest } from "@/lib/site/site-context";
import {
  buildOAuthStateCookie,
  generateOAuthStateNonce,
} from "@/server/oauth-state";
import { redirectWithSetCookies } from "@/server/session";
import { enforceRateLimit } from "@/server/rate-limit.service";

function stripWww(hostname: string): string {
  return hostname.toLowerCase().startsWith("www.")
    ? hostname.toLowerCase().slice(4)
    : hostname.toLowerCase();
}

/** Bounce only across different sites (e.g. terminal → www), never www ↔ apex. */
export function shouldBounceOAuthToCallbackHost(
  requestOrigin: string,
  callbackOrigin: string,
): boolean {
  if (requestOrigin === callbackOrigin) return false;
  try {
    const requestHost = stripWww(new URL(requestOrigin).hostname);
    const callbackHost = stripWww(new URL(callbackOrigin).hostname);
    // Same registrable host (www.altagroup.dev vs altagroup.dev): Domain=.altagroup.dev is enough.
    // Bouncing here loops when the platform also redirects apex ↔ www.
    if (requestHost === callbackHost) return false;
    return true;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/auth/discord")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limited = await enforceRateLimit(request, "oauth-login", 30, 60_000);
        if (limited) return limited;

        const config = getDiscordConfig();
        if (!config) {
          return new Response("Discord OAuth is not configured.", { status: 503 });
        }

        const url = new URL(request.url);
        const site = resolveSiteContextFromRequest(
          Object.fromEntries(url.searchParams),
          url.pathname,
        );
        const returnTo = url.searchParams.get("redirect") ?? site.defaultAuthenticatedRoute;
        const allowed = parseRedirectUriListForOAuth();
        const requestedReturnOrigin = url.searchParams.get("returnOrigin")?.trim();
        const returnOrigin =
          requestedReturnOrigin && isAllowedReturnOrigin(requestedReturnOrigin, allowed)
            ? requestedReturnOrigin
            : normalizeOAuthOrigin(url, site.key);

        const redirectUri = resolveOAuthCallbackUriForSite(returnOrigin);
        if (!redirectUri) {
          return new Response("Discord OAuth is not configured.", { status: 503 });
        }

        const callbackOrigin = new URL(redirectUri).origin;
        // Shared Discord callback lives on www/apex while login starts on bank/terminal.
        // Bounce onto the callback host first so alta_oauth_state is set where Discord returns.
        // Do not bounce www ↔ apex — that fights hosting redirects and causes "too many redirects".
        if (shouldBounceOAuthToCallbackHost(url.origin, callbackOrigin)) {
          const bounce = new URL("/api/auth/discord", callbackOrigin);
          bounce.searchParams.set("redirect", returnTo);
          bounce.searchParams.set("returnOrigin", returnOrigin);
          // #region agent log
          const bouncePayload = {
            fromOrigin: url.origin,
            callbackOrigin,
            returnOrigin,
            returnTo,
          };
          fetch("http://127.0.0.1:7929/ingest/900968cf-7850-40f1-892f-1e344d1892dd", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "49e5fc" },
            body: JSON.stringify({
              sessionId: "49e5fc",
              runId: "post-fix",
              hypothesisId: "OAUTH_BOUNCE",
              location: "routes/api/auth/discord.ts:bounce",
              message: "Bouncing OAuth start to shared callback host",
              data: bouncePayload,
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          console.error("[alta-debug-49e5fc] oauth-bounce", bouncePayload);
          // #endregion
          return Response.redirect(bounce.toString(), 302);
        }

        const nonce = generateOAuthStateNonce();
        const state = await sealJson({ returnTo, returnOrigin, nonce });
        if (!state) {
          return new Response("SESSION_SECRET is not configured.", { status: 503 });
        }
        const authorizeUrl = buildDiscordAuthorizeUrl(state, redirectUri, config.clientId);

        // Prefer cookie Domain for callback host (www/apex) so sibling hosts still work.
        const cookieHost = url.host;
        // #region agent log
        const startPayload = {
          cookieHost,
          callbackOrigin,
          returnOrigin,
          returnTo,
          bounced: false,
          sameRegistrable:
            stripWww(new URL(returnOrigin).hostname) === stripWww(url.hostname),
        };
        fetch("http://127.0.0.1:7929/ingest/900968cf-7850-40f1-892f-1e344d1892dd", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "49e5fc" },
          body: JSON.stringify({
            sessionId: "49e5fc",
            runId: "post-fix",
            hypothesisId: "OAUTH_BOUNCE",
            location: "routes/api/auth/discord.ts:authorize",
            message: "Issuing Discord authorize redirect with OAuth state cookie",
            data: startPayload,
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        console.error("[alta-debug-49e5fc] oauth-authorize", startPayload);
        // #endregion

        return redirectWithSetCookies(authorizeUrl, [
          buildOAuthStateCookie(nonce, cookieHost),
        ]);
      },
    },
  },
});
