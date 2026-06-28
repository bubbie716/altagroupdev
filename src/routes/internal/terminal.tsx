import { createFileRoute, redirect } from "@tanstack/react-router";

/** Mock terminal ops — not backed by production data. */
export const Route = createFileRoute("/internal/terminal")({
  beforeLoad: () => {
    throw redirect({ to: "/internal" });
  },
});
