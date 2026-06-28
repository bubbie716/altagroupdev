import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy list — canonical queue is /internal/queues/alta-card-applications */
export const Route = createFileRoute("/internal/alta-card/applications/")({
  beforeLoad: () => {
    throw redirect({ to: "/internal/queues/alta-card-applications" });
  },
});
