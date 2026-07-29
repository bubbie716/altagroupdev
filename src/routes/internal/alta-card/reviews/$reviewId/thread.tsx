import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { siteSearchPatch, validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";

export const Route = createFileRoute("/internal/alta-card/reviews/$reviewId/thread")({
  validateSearch: validateDevSiteSearch,
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/internal/alta-card/reviews/$reviewId",
      params: { reviewId: params.reviewId },
      search: normalizeInternalSearch({
        ...siteSearchPatch(search.site),
        section: "evidence",
      }),
    });
  },
});
