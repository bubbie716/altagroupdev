import { createFileRoute, redirect } from "@tanstack/react-router";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";

export const Route = createFileRoute("/bank/lending/deal-rooms/$dealRoomId")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/bank/lending/applications",
      search: { site: readDevSiteFromSearch(search) ?? "bank" },
      replace: true,
    });
  },
});
