import { createFileRoute, redirect } from "@tanstack/react-router";
import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccPageContainer } from "@/components/ncc/ncc-ui";
import { NccParticipantApplicationForm } from "@/components/ncc/ncc-participant-application-form";
import { SiteInternalLink } from "@/components/site/site-internal-link";

export const Route = createFileRoute("/participation/apply")({
  beforeLoad: async () => {
    const { fetchCurrentUser } = await import("@/lib/auth/auth.functions");
    const user = await fetchCurrentUser();
    if (!user) {
      throw redirect({
        to: "/login",
        search: { redirect: "/participation/apply" },
      });
    }
  },
  head: () => ({
    meta: [{ title: "Apply for Participation — Newport Clearing Corporation" }],
  }),
  component: ApplyRoute,
});

function ApplyRoute() {
  return (
    <NccLayout>
      <NccPageContainer>
        <div className="mb-6 border-b border-[#e5e7eb] pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">
            Participant application
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] text-[#6b7280]">
            Submit your institution profile for NCC TEST access and technical certification. Live
            settlement remains blocked until a later certification sprint.
          </p>
          <SiteInternalLink
            siteKey="ncc"
            to="/participation/applications"
            className="mt-3 inline-block text-[13px] text-[#0c4d32]"
          >
            View my applications →
          </SiteInternalLink>
        </div>
        <NccParticipantApplicationForm />
      </NccPageContainer>
    </NccLayout>
  );
}
