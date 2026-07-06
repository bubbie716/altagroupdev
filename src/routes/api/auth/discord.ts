import { createFileRoute } from "@tanstack/react-router";
import {
  buildSetCookie,
  getOAuthStateCookieName,
  oauthStateMaxAgeSec,
} from "@/server/session";
import { randomToken, sealJson } from "@/server/crypto";
import { buildDiscordAuthorizeUrl, getDiscordConfig, resolveDiscordRedirectUri } from "@/server/discord";
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
        const state = randomToken(24);
        const statePayload = await sealJson({ state, returnTo });
        if (!statePayload) {
          return new Response("SESSION_SECRET is not configured.", { status: 503 });
        }
        const oauthCookie = buildSetCookie(getOAuthStateCookieName(), statePayload, oauthStateMaxAgeSec());
        const redirectUri = resolveDiscordRedirectUri(request);
        if (!redirectUri) {
          return new Response("Discord OAuth is not configured.", { status: 503 });
        }
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
