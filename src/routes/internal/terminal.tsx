import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { readDevSiteFromSearch, siteSearchPatch } from "@/lib/site/preserve-dev-site-search";

/**
 * Layout for /internal/terminal/* — only the bare /internal/terminal index
 * redirects home. Child routes (e.g. settings) must still load.
 */
export const Route = createFileRoute("/internal/terminal")({
  beforeLoad: ({ location }) => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (path === "/internal/terminal") {
      throw redirect({
        to: "/internal",
        search: normalizeInternalSearch(
          siteSearchPatch(readDevSiteFromSearch(location.search as Record<string, unknown>)),
        ),
      });
    }
  },
  component: () => <Outlet />,
});
