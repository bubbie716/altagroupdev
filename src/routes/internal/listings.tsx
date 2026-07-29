import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { readDevSiteFromSearch, siteSearchPatch, validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";

/** Mock listings ops — not backed by production data. */
export const Route = createFileRoute("/internal/listings")({
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
