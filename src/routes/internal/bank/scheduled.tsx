import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { siteSearchPatch, validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";

/** Compatibility: scheduled transfers live under Money → Transfers. */
export const Route = createFileRoute("/internal/bank/scheduled")({
  validateSearch: validateDevSiteSearch,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/internal/bank/transfers",
      search: normalizeInternalSearch({
        ...siteSearchPatch(search.site),
        status: "scheduled",
      }),
    });
  },
});
