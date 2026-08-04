import { createFileRoute, redirect } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import { creditDeskApplicationBeforeLoad } from "@/lib/auth/credit-desk-guards";
import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";

/** Legacy deep link — apply opens as a modal on the Alta Card page. */
export const Route = createFileRoute("/bank/alta-card/apply")({
  beforeLoad: async (ctx) => {
    authBeforeLoad(ctx);
    await creditDeskApplicationBeforeLoad(ctx);
    throw redirect({
      to: "/bank/alta-card",
      search: normalizeInternalSearch({
        apply: "1",
        site: readDevSiteFromSearch(ctx.location.search) ?? "bank",
      }),
      replace: true,
    });
  },
});
