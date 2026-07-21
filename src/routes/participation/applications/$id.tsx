import { createFileRoute, redirect } from "@tanstack/react-router";
import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccPageContainer } from "@/components/ncc/ncc-ui";
import { NccParticipantApplicationForm } from "@/components/ncc/ncc-participant-application-form";
import { fetchMyParticipantApplication } from "@/lib/ncc/ncc-participant-application.functions";

export const Route = createFileRoute("/participation/applications/$id")({
  beforeLoad: async () => {
    const { fetchCurrentUser } = await import("@/lib/auth/auth.functions");
    const user = await fetchCurrentUser();
    if (!user) {
      throw redirect({
        to: "/login",
        search: { redirect: "/participation/applications" },
      });
    }
  },
  loader: ({ params }) => fetchMyParticipantApplication({ data: { id: params.id } }),
  head: () => ({
    meta: [{ title: "Application — Newport Clearing Corporation" }],
  }),
  component: ApplicationDetailRoute,
});

function ApplicationDetailRoute() {
  const app = Route.useLoaderData();
  return (
    <NccLayout>
      <NccPageContainer>
        <NccParticipantApplicationForm initial={app} />
      </NccPageContainer>
    </NccLayout>
  );
}
