import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy list — canonical queue is /internal/queues/alta-card-reviews */
export const Route = createFileRoute("/internal/alta-card/reviews/")({
  beforeLoad: () => {
    throw redirect({ to: "/internal/queues/alta-card-reviews" });
  },
});
