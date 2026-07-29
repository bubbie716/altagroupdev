import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { readDevSiteFromSearch, siteSearchPatch, validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";

export const Route = createFileRoute("/internal/lending/deal-rooms/")({
  validateSearch: validateDevSiteSearch,
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/internal/lending",
      search: normalizeInternalSearch(
        siteSearchPatch(readDevSiteFromSearch(location.search as Record<string, unknown>)),
      ),
    });
  },
});
