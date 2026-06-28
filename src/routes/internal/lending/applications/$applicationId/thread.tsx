import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/lending/applications/$applicationId/thread")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/internal/lending/applications/$applicationId",
      params: { applicationId: params.applicationId },
      search: { tab: "thread" },
    });
  },
});
