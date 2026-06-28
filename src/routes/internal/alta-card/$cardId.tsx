import { createFileRoute, Link } from "@tanstack/react-router";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalAltaCardDetailIntegration } from "@/components/bank/alta-card/internal-alta-card-detail-integration";
import { fetchInternalCardOperationsContext } from "@/lib/bank/alta-card-admin.functions";
import { fetchCardStatements } from "@/lib/bank/alta-card-statement.functions";
import { fetchInternalCardFeesRecord } from "@/lib/bank/alta-card-interest.functions";
import { fetchInternalAltaCardAutopayContext } from "@/lib/bank/alta-card-autopay.functions";
import { fetchResolvedRelationshipIntegrationBestEffort } from "@/lib/internal/relationship-intelligence.functions";

export const Route = createFileRoute("/internal/alta-card/$cardId")({
  validateSearch: (search: Record<string, unknown>) => ({
    suggestedTier:
      typeof search.suggestedTier === "string" ? (search.suggestedTier as AltaCardTierCode) : undefined,
    suggestedLimit:
      search.suggestedLimit != null && search.suggestedLimit !== ""
        ? Number(search.suggestedLimit)
        : undefined,
    suggestedRate:
      search.suggestedRate != null && search.suggestedRate !== ""
        ? Number(search.suggestedRate)
        : undefined,
    recommendationId:
      typeof search.recommendationId === "string" ? search.recommendationId : undefined,
  }),
  loader: async ({ params }) => {
    const [ops, statements, fees, autopay] = await Promise.all([
      fetchInternalCardOperationsContext({ data: params.cardId }),
      fetchCardStatements({ data: params.cardId }),
      fetchInternalCardFeesRecord({ data: params.cardId }),
      fetchInternalAltaCardAutopayContext({ data: params.cardId }).catch(() => ({
        context: { settings: { enabled: false, sourceAccountId: null, sourceAccountLabel: null, type: null, fixedAmount: null, lastRunAt: null, lastStatus: "not_run" as const, failureReason: null, canManage: true }, sourceAccounts: [] },
        audit: [],
      })),
    ]);
    const ownerUserId = ops.card.ownerUserId;
    const companyId = ops.card.companyId;
    const integration = ownerUserId
      ? await fetchResolvedRelationshipIntegrationBestEffort({
          userId: ownerUserId,
          companyId,
          context: "ALTA_CARD",
        })
      : null;
    return { ops, statements, fees, autopay, integration, ownerUserId, companyId };
  },
  head: () => ({ meta: [{ title: "Alta Card Detail — Alta Internal" }] }),
  component: InternalAltaCardDetail,
});

function InternalAltaCardDetail() {
  const { ops, statements, fees, autopay, integration, ownerUserId } = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <InternalPageShell
      title="Alta Card detail"
      description="Full card operations — status, terms, payments, adjustments, and relationship pricing."
    >
      <Link
        to="/internal/alta-card"
        className="mb-6 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        ← All cards
      </Link>
      <InternalAltaCardDetailIntegration
        ops={ops}
        statements={statements}
        fees={fees}
        autopay={autopay}
        integration={integration}
        ownerUserId={ownerUserId}
        searchDefaults={{
          tier: search.suggestedTier,
          limit: search.suggestedLimit,
          rate: search.suggestedRate,
          recommendationId: search.recommendationId,
        }}
      />
    </InternalPageShell>
  );
}
