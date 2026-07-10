import { createFileRoute } from "@tanstack/react-router";
import {
  buildSetCookie,
  getSessionCookieName,
  loginErrorRedirect,
  redirectWithSetCookies,
  sessionMaxAgeSec,
} from "@/server/session";
import { redeemSessionHandoff } from "@/server/session-handoff";
import { resolveSiteContextFromRequest } from "@/lib/site/site-context";
import { enforceRateLimit } from "@/server/rate-limit.service";

export const Route = createFileRoute("/api/auth/session/handoff")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limited = await enforceRateLimit(request, "session-handoff", 20, 60_000);
        if (limited) return limited;

        const url = new URL(request.url);
        const handoff =
          url.searchParams.get("handoff")?.trim() || url.searchParams.get("token")?.trim();
        const redirectParam = url.searchParams.get("redirect");

        if (!handoff) {
          return loginErrorRedirect(request, "invalid_state");
        }

        const payload = await redeemSessionHandoff(handoff);
        if (!payload) {
          return loginErrorRedirect(request, "invalid_state");
        }

        const site = resolveSiteContextFromRequest(
          Object.fromEntries(url.searchParams),
          url.pathname,
        );
        const safeRedirect =
          redirectParam?.startsWith("/") && !redirectParam.startsWith("//")
            ? redirectParam
            : site.defaultAuthenticatedRoute;

        return redirectWithSetCookies(new URL(safeRedirect, request.url).toString(), [
          buildSetCookie(
            getSessionCookieName(),
            payload.sessionToken,
            sessionMaxAgeSec(),
            url.host,
          ),
        ]);
      },
    },
  },
});
