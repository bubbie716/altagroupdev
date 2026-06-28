import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/companies/$companyId/relationship")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/internal/companies/$companyId",
      params: { companyId: params.companyId },
      search: { tab: "relationship" },
    });
  },
});
