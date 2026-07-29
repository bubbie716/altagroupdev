import { createFileRoute, redirect } from "@tanstack/react-router";
import { companyRelationshipSearch } from "@/lib/internal/record-workspace-search";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { siteSearchPatch, validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";

export const Route = createFileRoute("/internal/companies/$companyId/relationship")({
  validateSearch: validateDevSiteSearch,
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/internal/companies/$companyId",
      params: { companyId: params.companyId },
      search: normalizeInternalSearch({
        ...siteSearchPatch(search.site),
        ...companyRelationshipSearch(),
      }),
    });
  },
});
