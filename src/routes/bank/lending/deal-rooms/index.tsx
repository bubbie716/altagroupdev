import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/lending/deal-rooms/")({
  beforeLoad: () => {
    throw redirect({ to: "/bank/lending/applications" });
  },
});
