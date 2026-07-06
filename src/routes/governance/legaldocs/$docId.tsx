import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/governance/legaldocs/$docId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/legal/$docId",
      params: { docId: params.docId },
      replace: true,
    });
  },
});
