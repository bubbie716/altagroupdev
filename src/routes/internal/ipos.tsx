import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { readDevSiteFromSearch, siteSearchPatch, validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";

/** Mock IPO ops — not backed by production data. */
export const Route = createFileRoute("/internal/ipos")({
  validateSearch: validateDevSiteSearch,
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/internal",
      search: normalizeInternalSearch(
        siteSearchPatch(readDevSiteFromSearch(location.search as Record<string, unknown>)),
      ),
    });
  },
});
