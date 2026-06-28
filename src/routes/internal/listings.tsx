import { createFileRoute, redirect } from "@tanstack/react-router";

/** Mock listings ops — not backed by production data. */
export const Route = createFileRoute("/internal/listings")({
  beforeLoad: () => {
    throw redirect({ to: "/internal" });
  },
});
