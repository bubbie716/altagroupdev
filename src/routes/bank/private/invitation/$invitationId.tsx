import { createFileRoute, Link } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { fetchAltaPrivateInvitationRecord } from "@/lib/bank/alta-private.functions";
import { AltaPrivateInvitationExperience } from "@/components/bank/alta-private/alta-private-invitation-experience";

export const Route = createFileRoute("/bank/private/invitation/$invitationId")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    try {
      const invitation = await fetchAltaPrivateInvitationRecord({ data: params.invitationId });
      return { invitation, notFound: false as const };
    } catch {
      return { invitation: null, notFound: true as const };
    }
  },
  head: () => ({
    meta: [{ title: "Alta Private Invitation — Alta Bank" }],
  }),
  component: AltaPrivateInvitationRoute,
});

function AltaPrivateInvitationRoute() {
  const { invitation, notFound } = Route.useLoaderData();

  if (notFound || !invitation) {
    return (
      <>
        <BankPageMeta
          eyebrow="Alta Bank · Private"
          title="Alta Private Invitation"
          description="This invitation is no longer available."
        />
        <div className="mt-8 rounded-xl border border-border bg-surface-1/80 p-6 sm:p-8">
          <h2 className="font-serif text-2xl tracking-tight">Invitation unavailable</h2>
          <p className="mt-3 max-w-xl text-[15px] text-muted-foreground">
            This invitation may have expired, been revoked, or already been responded to.
          </p>
          <Link
            to="/bank/private"
            className="mt-6 inline-flex rounded-md border border-gold/50 bg-gold/[0.08] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-gold/[0.14]"
          >
            View Alta Private →
          </Link>
        </div>
      </>
    );
  }

  if (invitation.status !== "pending") {
    return (
      <>
        <BankPageMeta
          eyebrow="Alta Bank · Private"
          title="Alta Private Invitation"
          description="This invitation has already been responded to."
        />
        <div className="mt-8 rounded-xl border border-border bg-surface-1/80 p-6 sm:p-8">
          <h2 className="font-serif text-2xl tracking-tight capitalize">{invitation.status}</h2>
          <p className="mt-3 max-w-xl text-[15px] text-muted-foreground">
            {invitation.status === "accepted"
              ? "Your Alta Private membership is active."
              : "This invitation is no longer pending."}
          </p>
          <Link
            to="/bank/private"
            className="mt-6 inline-flex rounded-md border border-gold/50 bg-gold/[0.08] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-gold/[0.14]"
          >
            View Alta Private →
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Private"
        title="You're Invited to Alta Private"
        description="Accept your invitation to activate Alta Private membership."
      />
      <div className="mt-8">
        <AltaPrivateInvitationExperience invitation={invitation} />
      </div>
    </>
  );
}
