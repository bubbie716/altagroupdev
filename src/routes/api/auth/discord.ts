import { createFileRoute } from "@tanstack/react-router";
import { normalizeOAuthOrigin } from "@/lib/site/oauth-origin";
import {
  buildSetCookie,
  getOAuthStateCookieName,
  oauthStateMaxAgeSec,
} from "@/server/session";
import { randomToken, sealJson } from "@/server/crypto";
import { buildDiscordAuthorizeUrl, getDiscordConfig, resolveOAuthCallbackUri } from "@/server/discord";
import { resolveSiteContextFromRequest } from "@/lib/site/site-context";

export const Route = createFileRoute("/api/auth/discord")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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
        const redirectUri = resolveOAuthCallbackUri(returnOrigin);
        if (!redirectUri) {
          const expectedCallback = `${returnOrigin}/api/auth/discord/callback`;
          return new Response(
            `Discord OAuth callback is not configured for ${returnOrigin}. Add ${expectedCallback} to DISCORD_REDIRECT_URI and Discord Developer Portal redirects.`,
            { status: 503 },
          );
        }

        const state = randomToken(24);
        const statePayload = await sealJson({ state, returnTo, returnOrigin });
        if (!statePayload) {
          return new Response("SESSION_SECRET is not configured.", { status: 503 });
        }
        const oauthCookie = buildSetCookie(
          getOAuthStateCookieName(),
          statePayload,
          oauthStateMaxAgeSec(),
          url.host,
        );
        const authorizeUrl = buildDiscordAuthorizeUrl(state, redirectUri, config.clientId);

        return new Response(null, {
          status: 302,
          headers: {
            Location: authorizeUrl,
            "Set-Cookie": oauthCookie,
          },
        });
      },
    },
  },
});
