import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/lending/deal-rooms/$dealRoomId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/internal/lending/applications/$applicationId",
      params: { applicationId: params.dealRoomId },
      search: { tab: "thread" },
    });
  },
});
