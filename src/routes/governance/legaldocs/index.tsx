import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/governance/legaldocs/")({
  beforeLoad: () => {
    throw redirect({ to: "/legal", replace: true });
  },
});
