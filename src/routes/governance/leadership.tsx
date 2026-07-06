import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/governance/leadership")({
  beforeLoad: () => {
    throw redirect({ to: "/leadership", replace: true });
  },
});
