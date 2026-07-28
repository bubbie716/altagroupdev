import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibility — scheduled instructions live in account Activity → Scheduled. */
export const Route = createFileRoute("/bank/account/$accountId/scheduled")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/bank/account/$accountId/activity",
      params,
      search: { view: "scheduled" },
      replace: true,
    });
  },
});
