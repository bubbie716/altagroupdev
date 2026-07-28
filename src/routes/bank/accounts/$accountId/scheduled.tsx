import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compatibility alias — canonical path is /bank/account/$accountId/activity?view=scheduled. */
export const Route = createFileRoute("/bank/accounts/$accountId/scheduled")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/bank/account/$accountId/activity",
      params,
      search: { view: "scheduled" },
      replace: true,
    });
  },
});
