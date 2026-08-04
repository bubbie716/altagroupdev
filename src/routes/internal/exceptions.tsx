import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { siteSearchPatch, validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";

export const Route = createFileRoute("/internal/exceptions")({
  validateSearch: validateDevSiteSearch,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/internal/queues/exceptions",
      search: normalizeInternalSearch(siteSearchPatch(search.site ?? "corporate")),
      replace: true,
    });
  },
});
