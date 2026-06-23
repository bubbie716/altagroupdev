import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/bank/deposits")({
  beforeLoad: () => {
    throw redirect({ to: "/bank/products" });
  },
});
