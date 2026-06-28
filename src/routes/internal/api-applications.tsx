import { createFileRoute, redirect } from "@tanstack/react-router";

/** Mock API applications — not backed by production data. */
export const Route = createFileRoute("/internal/api-applications")({
  beforeLoad: () => {
    throw redirect({ to: "/internal" });
  },
});
