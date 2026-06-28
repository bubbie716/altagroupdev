import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/relationships/$userId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/internal/users/$userId",
      params: { userId: params.userId },
      search: { tab: "relationship" },
    });
  },
});
