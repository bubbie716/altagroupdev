import { createFileRoute } from "@tanstack/react-router";
import {
  buildSetCookie,
  getSessionCookieName,
  loginErrorRedirect,
  redirectWithSetCookies,
  sessionMaxAgeSec,
} from "@/server/session";
import { readSessionHandoffToken } from "@/server/session-handoff";
import { resolveSiteContextFromRequest } from "@/lib/site/site-context";

export const Route = createFileRoute("/api/auth/session/handoff")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const redirectParam = url.searchParams.get("redirect");

        if (!token) {
          return loginErrorRedirect(request, "invalid_state");
        }

        const payload = await readSessionHandoffToken(token);
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
