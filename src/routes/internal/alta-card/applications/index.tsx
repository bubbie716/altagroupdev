import { createFileRoute, redirect } from "@tanstack/react-router";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";

/** Legacy list — applications are Inbox work. */
export const Route = createFileRoute("/internal/alta-card/applications/")({
  validateSearch: (s: Record<string, unknown>) => ({
    site: readDevSiteFromSearch(s),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/internal/inbox",
      search: normalizeInternalSearch(
        withInternalSiteSearch(
          { category: "cards" as const, type: "alta_card_application" as const },
          search.site,
        ),
      ),
    });
  },
});
