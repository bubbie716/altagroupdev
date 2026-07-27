import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy transfers hub — money movement is overlay-first (`?action=transfer`). */
export const Route = createFileRoute("/bank/transfers/")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/bank",
      search: search as Record<string, unknown>,
    });
  },
});
