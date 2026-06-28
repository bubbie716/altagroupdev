"use client";

import { useRouter } from "@tanstack/react-router";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { InternalAltaCardDetailPanel } from "@/components/bank/alta-card/internal-alta-card-panel";
import { InternalAltaCardOpsPanel } from "@/components/bank/alta-card/internal-alta-card-ops-panel";
import { InternalAltaCardAutopayPanel } from "@/components/bank/alta-card/internal-alta-card-autopay-panel";
import { InternalAltaCardDetailRelationshipIntegration } from "@/components/internal/relationship-integration-wrappers";
import { useAltaCardSuggestedDefaults } from "@/components/internal/relationship-integration-blocks";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";

type Props = {
  ops: React.ComponentProps<typeof InternalAltaCardOpsPanel>["ops"];
  statements: React.ComponentProps<typeof InternalAltaCardDetailPanel>["statements"];
  fees: React.ComponentProps<typeof InternalAltaCardDetailPanel>["fees"];
  autopay: React.ComponentProps<typeof InternalAltaCardAutopayPanel>["initialContext"] extends infer C
    ? { context: C; audit: React.ComponentProps<typeof InternalAltaCardAutopayPanel>["initialAudit"] }
    : never;
  integration: ResolvedRelationshipIntegration | null;
  ownerUserId: string | null;
  searchDefaults?: {
    tier?: AltaCardTierCode;
    limit?: number;
    rate?: number;
    recommendationId?: string;
  };
};

export function InternalAltaCardDetailIntegration(props: Props) {
  const router = useRouter();
  const { suggested, applyPrefill, showBanner } = useAltaCardSuggestedDefaults(props.searchDefaults);
  const merged = {
    tier: suggested?.tier ?? props.searchDefaults?.tier,
    limit: suggested?.limit ?? props.searchDefaults?.limit,
    rate: suggested?.rate ?? props.searchDefaults?.rate,
    recommendationId: suggested?.recommendationId ?? props.searchDefaults?.recommendationId,
  };

  return (
    <>
      {props.integration && props.ownerUserId ? (
        <InternalAltaCardDetailRelationshipIntegration
          integration={props.integration}
          onUseRecommendation={applyPrefill}
        />
      ) : null}
      {showBanner || props.searchDefaults?.recommendationId ? (
        <p className="mb-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[13px]">
          Relationship recommendation prefilled below — confirm manually before saving. Reason required.
        </p>
      ) : null}
      <InternalAltaCardOpsPanel
        ops={props.ops}
        suggestedDefaults={merged}
        onRefresh={async () => {
          await router.invalidate();
        }}
      />
      <InternalAltaCardAutopayPanel
        cardId={props.ops.card.id}
        initialContext={props.autopay.context}
        initialAudit={props.autopay.audit}
        onRefresh={async () => {
          await router.invalidate();
        }}
      />
      <InternalAltaCardDetailPanel
        card={props.ops.card}
        statements={props.statements}
        fees={props.fees}
        onRefresh={async () => {
          await router.invalidate();
        }}
      />
    </>
  );
}
