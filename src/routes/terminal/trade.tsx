import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy trade ticket → Orders */
export const Route = createFileRoute("/terminal/trade")({
  beforeLoad: () => {
    throw redirect({ to: "/terminal/orders", replace: true });
  },
});
