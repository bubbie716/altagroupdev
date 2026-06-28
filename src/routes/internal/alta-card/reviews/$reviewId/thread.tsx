import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/alta-card/reviews/$reviewId/thread")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/internal/alta-card/reviews/$reviewId",
      params: { reviewId: params.reviewId },
      search: { tab: "thread" },
    });
  },
});
