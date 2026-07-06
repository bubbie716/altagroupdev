import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/company/leadership")({
  beforeLoad: () => {
    throw redirect({ to: "/leadership", replace: true });
  },
});
