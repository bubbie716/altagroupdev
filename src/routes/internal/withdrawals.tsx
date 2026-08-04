import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";

/** Compatibility URL kept for old operator bookmarks. */
export const Route = createFileRoute("/internal/withdrawals")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/internal/queues/withdrawals",
      search: normalizeInternalSearch({ site: readDevSiteFromSearch(search) ?? "bank" }),
      replace: true,
    });
  },
});
