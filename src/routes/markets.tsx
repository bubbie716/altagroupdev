import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/markets")({
  beforeLoad: () => {
    throw redirect({ to: "/exchange" });
  },
});
