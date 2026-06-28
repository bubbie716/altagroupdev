import { createFileRoute, redirect } from "@tanstack/react-router";

/** Mock exchange ops — not backed by production data. */
export const Route = createFileRoute("/internal/exchange")({
  beforeLoad: () => {
    throw redirect({ to: "/internal" });
  },
});
