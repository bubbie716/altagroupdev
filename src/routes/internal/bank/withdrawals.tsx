import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/bank/withdrawals")({
  beforeLoad: () => {
    throw redirect({ to: "/internal/queues/withdrawals" });
  },
});
