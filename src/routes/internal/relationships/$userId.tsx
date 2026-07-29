import { createFileRoute, redirect } from "@tanstack/react-router";
import { customerRelationshipSearch } from "@/lib/internal/record-workspace-search";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { siteSearchPatch, validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";

export const Route = createFileRoute("/internal/relationships/$userId")({
  validateSearch: validateDevSiteSearch,
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/internal/users/$userId",
      params: { userId: params.userId },
      search: normalizeInternalSearch({
        ...siteSearchPatch(search.site),
        ...customerRelationshipSearch(),
      }),
    });
  },
});
