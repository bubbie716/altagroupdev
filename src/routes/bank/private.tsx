import { createFileRoute } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { fetchUserAltaCard } from "@/lib/bank/alta-card.functions";
import { fetchCustomerRelationshipView } from "@/lib/bank/relationship-intelligence.functions";
import { fetchCustomerAltaPrivatePageState } from "@/lib/bank/alta-private.functions";
import {
  AltaPrivateAspirationalPage,
  AltaPrivateDeclinedPage,
  AltaPrivateInvitationExperience,
} from "@/components/bank/alta-private/alta-private-invitation-experience";
import { AltaPrivateMemberExperience } from "@/components/bank/alta-private/alta-private-member-experience";

export const Route = createFileRoute("/bank/private")({
  beforeLoad: authBeforeLoad,
  loader: async () => {
    const [card, relationshipView, pageState] = await Promise.all([
      fetchUserAltaCard().catch(() => null),
      fetchCustomerRelationshipView().catch(() => null),
      fetchCustomerAltaPrivatePageState(),
    ]);
    return {
      altaCardId: card?.id ?? null,
      relationshipView,
      pageState,
    };
  },
  head: () => ({
    meta: [{ title: "Alta Private — Relationship-managed banking" }],
  }),
  component: BankPrivate,
});

function BankPrivate() {
  const { altaCardId, relationshipView, pageState } = Route.useLoaderData();

  const ctx = {
    isPrivateClient: pageState.kind === "member",
    altaCardId,
    bankerName: null,
    bankerTitle: null,
  };

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Private"
        title="Alta Private"
        description="Invitation-only private banking for Alta's most significant client relationships."
      />

      <div className="mt-8">
        {pageState.kind === "member" ? (
          <AltaPrivateMemberExperience ctx={ctx} relationshipView={relationshipView} />
        ) : pageState.kind === "invited" ? (
          <AltaPrivateInvitationExperience invitation={pageState.invitation} />
        ) : pageState.kind === "declined" ? (
          <AltaPrivateDeclinedPage />
        ) : (
          <AltaPrivateAspirationalPage />
        )}
      </div>
    </>
  );
}
