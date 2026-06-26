import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/lending/deal-rooms/$dealRoomId")({
  beforeLoad: () => {
    throw redirect({ to: "/bank/lending/applications" });
  },
});
