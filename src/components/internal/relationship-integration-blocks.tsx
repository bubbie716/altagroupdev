"use client";

import { useState } from "react";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import type { RecommendationPrefill } from "@/lib/bank/relationship-intelligence-types";
import { RelationshipIntelligencePanel } from "@/components/internal/relationship-intelligence-panel";
import { RelationshipRecommendationPanel } from "@/components/internal/relationship-recommendation-panel";
import { PreApprovalReadinessPanel } from "@/components/internal/pre-approval-readiness-panel";
import { CompanyRelationshipIntelligencePanel } from "@/components/internal/company-relationship-intelligence-integration-panel";
import { CompanyRelationshipRecommendationContextPanel } from "@/components/internal/company-relationship-recommendation-context-panel";
import type { RelationshipIntegrationBundle } from "@/lib/internal/relationship-integration.types";
import type { CompanyRelationshipIntegrationBundle } from "@/lib/internal/company-relationship-integration.types";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";

type AltaCardSearchDefaults = {
  tier?: AltaCardTierCode;
  limit?: number;
  rate?: number;
  recommendationId?: string;
};

export function useAltaCardSuggestedDefaults(initial?: AltaCardSearchDefaults) {
  const [suggested, setSuggested] = useState<{
    tier?: AltaCardTierCode;
    limit?: number;
    rate?: number;
    recommendationId?: string;
  } | null>(initial ? { ...initial } : null);

  function applyPrefill(prefill: RecommendationPrefill) {
    setSuggested({
      tier: prefill.suggestedTier as AltaCardTierCode | undefined,
      limit: prefill.suggestedLimit,
      rate: prefill.suggestedRate,
      recommendationId: prefill.recommendationId,
    });
  }

  return {
    suggested,
    applyPrefill,
    showBanner: suggested != null && Boolean(suggested.recommendationId),
  };
}

export function CompanyAltaCardRelationshipIntegrationBlock({
  bundle,
  onUseRecommendation,
}: {
  bundle: CompanyRelationshipIntegrationBundle;
  onUseRecommendation?: (prefill: RecommendationPrefill) => void;
}) {
  return (
    <div className="mb-8 space-y-6">
      <CompanyRelationshipIntelligencePanel panel={bundle.panel} context="ALTA_CARD" />
      <CompanyRelationshipRecommendationContextPanel
        context="ALTA_CARD"
        recommendations={bundle.recommendations}
        onUseRecommendation={onUseRecommendation}
      />
    </div>
  );
}

export function CompanyLendingRelationshipIntegrationBlock({
  bundle,
  onReviewReadiness,
  reviewingReadiness = false,
  variant = "default",
}: {
  bundle: CompanyRelationshipIntegrationBundle;
  onReviewReadiness?: () => void;
  reviewingReadiness?: boolean;
  variant?: "default" | "dealRoom";
}) {
  const activeRecommendations = bundle.recommendations.filter((row) => row.status === "ACTIVE");
  const showRecommendations = variant !== "dealRoom" || activeRecommendations.length > 0;
  const containerClass =
    variant === "dealRoom" ? "space-y-3" : "mb-8 space-y-6";

  return (
    <div className={containerClass}>
      <CompanyRelationshipIntelligencePanel
        panel={bundle.panel}
        context="LENDING"
        showLendingSignals
        compact={variant === "dealRoom"}
      />
      {showRecommendations ? (
        <CompanyRelationshipRecommendationContextPanel
          context="LENDING"
          recommendations={bundle.recommendations}
        />
      ) : null}
      {bundle.preApprovalReadiness ? (
        <PreApprovalReadinessPanel
          readiness={bundle.preApprovalReadiness}
          onReview={onReviewReadiness}
          reviewing={reviewingReadiness}
        />
      ) : null}
    </div>
  );
}

export function ResolvedAltaCardRelationshipIntegrationBlock({
  integration,
  onUseRecommendation,
}: {
  integration: ResolvedRelationshipIntegration | null;
  onUseRecommendation?: (prefill: RecommendationPrefill) => void;
}) {
  if (!integration) return null;
  if (integration.scope === "company") {
    return (
      <CompanyAltaCardRelationshipIntegrationBlock
        bundle={integration.bundle}
        onUseRecommendation={onUseRecommendation}
      />
    );
  }
  return (
    <AltaCardRelationshipIntegrationBlock
      bundle={integration.bundle}
      onUseRecommendation={onUseRecommendation}
    />
  );
}

export function ResolvedLendingRelationshipIntegrationBlock({
  integration,
  onReviewReadiness,
  reviewingReadiness = false,
  variant = "default",
}: {
  integration: ResolvedRelationshipIntegration | null;
  onReviewReadiness?: () => void;
  reviewingReadiness?: boolean;
  variant?: "default" | "dealRoom";
}) {
  if (!integration) return null;
  if (integration.scope === "company") {
    return (
      <CompanyLendingRelationshipIntegrationBlock
        bundle={integration.bundle}
        onReviewReadiness={onReviewReadiness}
        reviewingReadiness={reviewingReadiness}
        variant={variant}
      />
    );
  }
  return (
    <LendingRelationshipIntegrationBlock
      bundle={integration.bundle}
      onReviewReadiness={onReviewReadiness}
      reviewingReadiness={reviewingReadiness}
      variant={variant}
    />
  );
}

export function AltaCardRelationshipIntegrationBlock({
  bundle,
  onUseRecommendation,
}: {
  bundle: RelationshipIntegrationBundle;
  onUseRecommendation?: (prefill: RecommendationPrefill) => void;
}) {
  return (
    <div className="mb-8 space-y-6">
      <RelationshipIntelligencePanel panel={bundle.panel} context="ALTA_CARD" />
      <RelationshipRecommendationPanel
        userId={bundle.panel.userId}
        context="ALTA_CARD"
        recommendations={bundle.recommendations}
        onUseRecommendation={onUseRecommendation}
      />
    </div>
  );
}

export function LendingRelationshipIntegrationBlock({
  bundle,
  onReviewReadiness,
  reviewingReadiness = false,
  variant = "default",
}: {
  bundle: RelationshipIntegrationBundle;
  onReviewReadiness?: () => void;
  reviewingReadiness?: boolean;
  variant?: "default" | "dealRoom";
}) {
  const activeRecommendations = bundle.recommendations.filter((row) => row.status === "ACTIVE");
  const showRecommendations = variant !== "dealRoom" || activeRecommendations.length > 0;
  const containerClass =
    variant === "dealRoom" ? "space-y-3" : "mb-8 space-y-6";

  return (
    <div className={containerClass}>
      <RelationshipIntelligencePanel
        panel={bundle.panel}
        context="LENDING"
        showLendingSignals
        compact={variant === "dealRoom"}
      />
      {showRecommendations ? (
        <RelationshipRecommendationPanel
          userId={bundle.panel.userId}
          context="LENDING"
          recommendations={bundle.recommendations}
          compact={variant === "dealRoom"}
        />
      ) : null}
      {bundle.preApprovalReadiness ? (
        <PreApprovalReadinessPanel
          readiness={bundle.preApprovalReadiness}
          onReview={onReviewReadiness}
          reviewing={reviewingReadiness}
        />
      ) : null}
    </div>
  );
}
