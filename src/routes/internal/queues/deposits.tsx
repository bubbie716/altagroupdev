import { createFileRoute, redirect } from "@tanstack/react-router";
import { LEGACY_QUEUE_TO_INBOX } from "@/lib/internal/inbox-types";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";

/** Compatibility: deposits queue → Inbox Money / deposit filter. */
export const Route = createFileRoute("/internal/queues/deposits")({
  validateSearch: validateDevSiteSearch,
  beforeLoad: ({ search }) => {
    const mapped = LEGACY_QUEUE_TO_INBOX.deposits!;
    throw redirect({
      to: "/internal/inbox",
      search: normalizeInternalSearch(
        withInternalSiteSearch({ category: mapped.category, type: mapped.type }, search.site),
      ),
    });
  },
});
