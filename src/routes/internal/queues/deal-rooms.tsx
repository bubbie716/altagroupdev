import { createFileRoute, redirect } from "@tanstack/react-router";
import { LEGACY_QUEUE_TO_INBOX } from "@/lib/internal/inbox-types";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";

export const Route = createFileRoute("/internal/queues/deal-rooms")({
  validateSearch: validateDevSiteSearch,
  beforeLoad: ({ search }) => {
    const mapped = LEGACY_QUEUE_TO_INBOX["deal-rooms"]!;
    throw redirect({
      to: "/internal/inbox",
      search: normalizeInternalSearch(withInternalSiteSearch({ type: mapped.type }, search.site)),
    });
  },
});
