import { createFileRoute } from "@tanstack/react-router";
import {
  buildSetCookie,
  getOAuthStateCookieName,
  oauthStateMaxAgeSec,
} from "@/server/session";
import { randomToken, sealJson } from "@/server/crypto";
import { buildDiscordAuthorizeUrl, getDiscordConfig } from "@/server/discord";

export const Route = createFileRoute("/api/auth/discord")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const config = getDiscordConfig();
        if (!config) {
          return new Response("Discord OAuth is not configured.", { status: 503 });
        }

        const url = new URL(request.url);
        const returnTo = url.searchParams.get("redirect") ?? "/profile";
        const state = randomToken(24);
        const statePayload = await sealJson({ state, returnTo });
        if (!statePayload) {
          return new Response("SESSION_SECRET is not configured.", { status: 503 });
        }
        const oauthCookie = buildSetCookie(getOAuthStateCookieName(), statePayload, oauthStateMaxAgeSec());
        const authorizeUrl = buildDiscordAuthorizeUrl(state, config.redirectUri, config.clientId);

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
