import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/admin/clients")({
  beforeLoad: () => {
    throw redirect({ to: "/internal/users" });
  },
});
