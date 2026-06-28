import { createFileRoute, redirect } from "@tanstack/react-router";

/** Mock IPO ops — not backed by production data. */
export const Route = createFileRoute("/internal/ipos")({
  beforeLoad: () => {
    throw redirect({ to: "/internal" });
  },
});
