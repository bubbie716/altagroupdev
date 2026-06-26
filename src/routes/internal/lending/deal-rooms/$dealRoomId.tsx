import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/lending/deal-rooms/$dealRoomId")({
  beforeLoad: () => {
    throw redirect({ to: "/internal/lending" });
  },
});
