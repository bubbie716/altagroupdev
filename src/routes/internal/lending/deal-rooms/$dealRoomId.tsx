import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveInternalLegacyDealRoomRedirect } from "@/lib/bank/lending.functions";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { siteSearchPatch, validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";

export const Route = createFileRoute("/internal/lending/deal-rooms/$dealRoomId")({
  validateSearch: validateDevSiteSearch,
  beforeLoad: async ({ params, search }) => {
    const target = await resolveInternalLegacyDealRoomRedirect({ data: params.dealRoomId });
    throw redirect({
      to: target.to,
      params: target.params,
      search: normalizeInternalSearch({
        ...siteSearchPatch(search.site),
        ...target.search,
      }),
    });
  },
});
