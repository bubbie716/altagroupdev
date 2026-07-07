import { createFileRoute } from "@tanstack/react-router";
import { normalizeOAuthOrigin } from "@/lib/site/oauth-origin";
import { randomToken, sealJson } from "@/server/crypto";
import { buildDiscordAuthorizeUrl, getDiscordConfig, resolveOAuthCallbackUriForSite } from "@/server/discord";
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
        const redirectUri = resolveOAuthCallbackUriForSite(returnOrigin);
        if (!redirectUri) {
          return new Response("Discord OAuth is not configured.", { status: 503 });
        }

        const state = await sealJson({ returnTo, returnOrigin, nonce: randomToken(16) });
        if (!state) {
          return new Response("SESSION_SECRET is not configured.", { status: 503 });
        }
        const authorizeUrl = buildDiscordAuthorizeUrl(state, redirectUri, config.clientId);

        return new Response(null, {
          status: 302,
          headers: {
            Location: authorizeUrl,
          },
        });
      },
    },
  },
});
