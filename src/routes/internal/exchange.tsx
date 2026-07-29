import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";

/**
 * Compatibility layout for /internal/exchange/*.
 * Bare index redirects to Terminal home; settings redirect to Terminal Settings.
 * Exchange must never fall into Corporate navigation.
 */
export const Route = createFileRoute("/internal/exchange")({
  beforeLoad: ({ location }) => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    const incoming = location.search as Record<string, unknown>;
    if (path === "/internal/exchange") {
      throw redirect({
        to: "/internal",
        search: normalizeInternalSearch({ site: "terminal" }),
      });
    }
    if (path === "/internal/exchange/settings") {
      const section =
        typeof incoming.section === "string" && incoming.section.trim()
          ? incoming.section.trim()
          : "legacy-host";
      throw redirect({
        to: "/internal/terminal/settings",
        search: normalizeInternalSearch({
          site: "terminal",
          section,
        }),
      });
    }
    // Any other exchange internal path → Terminal home (preserve bookmarks safely).
    if (path.startsWith("/internal/exchange")) {
      void readDevSiteFromSearch(incoming);
      throw redirect({
        to: "/internal",
        search: normalizeInternalSearch({ site: "terminal" }),
      });
    }
  },
  component: () => <Outlet />,
});
