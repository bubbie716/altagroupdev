import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";

export const Route = createFileRoute("/bank/admin/clients")({
  beforeLoad: ({ location }) => {
    const site = readDevSiteFromSearch(location.search as Record<string, unknown>) ?? "bank";
    throw redirect({ to: "/internal/users", search: normalizeInternalSearch({ site }) });
  },
});
