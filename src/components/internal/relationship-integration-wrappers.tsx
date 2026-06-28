"use client";

import { useState } from "react";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import type { RecommendationPrefill } from "@/lib/bank/relationship-intelligence-types";
import {
  ResolvedAltaCardRelationshipIntegrationBlock,
  ResolvedLendingRelationshipIntegrationBlock,
  useAltaCardSuggestedDefaults,
} from "@/components/internal/relationship-integration-blocks";
import { DealRoomRelationshipContextBar } from "@/components/internal/deal-room-relationship-context-bar";
import {
  recordPreApprovalReadinessViewedRecord,
} from "@/lib/internal/relationship-intelligence.functions";
import { recordCompanyPreApprovalReadinessViewedRecord } from "@/lib/internal/company-relationship-intelligence.functions";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";
import { companyRecommendationPrefillToAltaCardDefaults } from "@/components/internal/company-relationship-recommendation-context-panel";

export function AltaCardApplicationIntegration({
  integration,
  onPrefill,
}: {
  integration: ResolvedRelationshipIntegration | null;
  onPrefill: (values: { tier?: AltaCardTierCode; limit?: string; rate?: string }) => void;
}) {
  if (!integration) return null;
  return (
    <ResolvedAltaCardRelationshipIntegrationBlock
      integration={integration}
      onUseRecommendation={(prefill) => {
        const values = companyRecommendationPrefillToAltaCardDefaults(prefill);
        onPrefill({
          tier: (prefill.suggestedTier as AltaCardTierCode | undefined) ?? values.tier,
          limit: values.limit,
          rate: values.rate,
        });
      }}
    />
  );
}

export function AltaCardReviewIntegrationWithHook({
  integration,
  setApprovedTier,
  setApprovedLimit,
  setApprovedRate,
}: {
  integration: ResolvedRelationshipIntegration | null;
  setApprovedTier: (tier: AltaCardTierCode) => void;
  setApprovedLimit: (limit: string) => void;
  setApprovedRate: (rate: string) => void;
}) {
  const { applyPrefill, showBanner } = useAltaCardSuggestedDefaults();

  if (!integration) return null;

  return (
    <>
      <ResolvedAltaCardRelationshipIntegrationBlock
        integration={integration}
        onUseRecommendation={(prefill: RecommendationPrefill) => {
          applyPrefill(prefill);
          const values = companyRecommendationPrefillToAltaCardDefaults(prefill);
          if (values.tier) setApprovedTier(values.tier);
          if (values.limit) setApprovedLimit(values.limit);
          if (values.rate) setApprovedRate(values.rate);
        }}
      />
      {showBanner ? (
        <p className="mb-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[13px]">
          Recommendation prefilled in decision form — admin must confirm and provide reason.
        </p>
      ) : null}
    </>
  );
}

export function LendingThreadIntegration({
  integration,
  userId,
}: {
  integration: ResolvedRelationshipIntegration | null;
  userId: string;
}) {
  const [reviewing, setReviewing] = useState(false);

  if (!integration) return null;

  async function handleReviewReadiness() {
    setReviewing(true);
    try {
      if (integration.scope === "company") {
        await recordCompanyPreApprovalReadinessViewedRecord({
          data: { companyId: integration.bundle.panel.companyId, context: "LENDING" },
        });
      } else {
        await recordPreApprovalReadinessViewedRecord({ data: { userId, context: "LENDING" } });
      }
    } finally {
      setReviewing(false);
    }
  }

  return (
    <DealRoomRelationshipContextBar integration={integration}>
      <ResolvedLendingRelationshipIntegrationBlock
        integration={integration}
        variant="dealRoom"
        onReviewReadiness={() => void handleReviewReadiness()}
        reviewingReadiness={reviewing}
      />
    </DealRoomRelationshipContextBar>
  );
}

export function InternalAltaCardDetailRelationshipIntegration({
  integration,
  onUseRecommendation,
}: {
  integration: ResolvedRelationshipIntegration | null;
  onUseRecommendation: (prefill: RecommendationPrefill) => void;
}) {
  if (!integration) return null;
  return (
    <ResolvedAltaCardRelationshipIntegrationBlock
      integration={integration}
      onUseRecommendation={onUseRecommendation}
    />
  );
}
