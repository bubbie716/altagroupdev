import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";

/** Compatibility URL kept for old operator bookmarks. */
export const Route = createFileRoute("/internal/scheduled")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/internal/bank/transfers",
      search: normalizeInternalSearch({
        site: readDevSiteFromSearch(search) ?? "bank",
        status: "scheduled",
      }),
      replace: true,
    });
  },
});
