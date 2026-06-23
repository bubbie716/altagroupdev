import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/admin/private")({
  beforeLoad: () => {
    throw redirect({ to: "/internal/bank" });
  },
});
