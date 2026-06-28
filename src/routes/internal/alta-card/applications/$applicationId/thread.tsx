import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/alta-card/applications/$applicationId/thread")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/internal/alta-card/applications/$applicationId",
      params: { applicationId: params.applicationId },
      search: { tab: "thread" },
    });
  },
});
