import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/exceptions")({
  beforeLoad: () => {
    throw redirect({ to: "/internal/queues/exceptions" });
  },
});
