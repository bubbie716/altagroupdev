import { createFileRoute } from "@tanstack/react-router";
import { normalizeOAuthOrigin } from "@/lib/site/oauth-origin";
import { sealJson } from "@/server/crypto";
import { buildDiscordAuthorizeUrl, getDiscordConfig, resolveOAuthCallbackUriForSite } from "@/server/discord";
import { resolveSiteContextFromRequest } from "@/lib/site/site-context";
import {
  buildOAuthStateCookie,
  generateOAuthStateNonce,
} from "@/server/oauth-state";
import { redirectWithSetCookies } from "@/server/session";
import { enforceRateLimit } from "@/server/rate-limit.service";

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
        const returnOrigin = normalizeOAuthOrigin(url, site.key);
        const redirectUri = resolveOAuthCallbackUriForSite(returnOrigin);
        if (!redirectUri) {
          return new Response("Discord OAuth is not configured.", { status: 503 });
        }

        const nonce = generateOAuthStateNonce();
        const state = await sealJson({ returnTo, returnOrigin, nonce });
        if (!state) {
          return new Response("SESSION_SECRET is not configured.", { status: 503 });
        }
        const authorizeUrl = buildDiscordAuthorizeUrl(state, redirectUri, config.clientId);

        return redirectWithSetCookies(authorizeUrl, [
          buildOAuthStateCookie(nonce, url.host),
        ]);
      },
    },
  },
});
