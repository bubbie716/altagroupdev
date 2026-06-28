import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/bank/deposits")({
  beforeLoad: () => {
    throw redirect({ to: "/internal/queues/deposits" });
  },
});
