import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/admin/loans")({
  beforeLoad: () => {
    throw redirect({ to: "/internal/bank" });
  },
});
