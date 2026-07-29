import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { siteSearchPatch, validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";

export const Route = createFileRoute("/internal/lending/applications/$applicationId/thread")({
  validateSearch: validateDevSiteSearch,
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/internal/lending/applications/$applicationId",
      params: { applicationId: params.applicationId },
      search: normalizeInternalSearch({
        ...siteSearchPatch(search.site),
        section: "evidence",
      }),
    });
  },
});
