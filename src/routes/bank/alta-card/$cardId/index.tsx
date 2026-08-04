import { createFileRoute, redirect } from "@tanstack/react-router";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";

export const Route = createFileRoute("/bank/alta-card/$cardId/")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/bank/alta-card",
      search: { site: readDevSiteFromSearch(search) ?? "bank" },
      replace: true,
    });
  },
});
