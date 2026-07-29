"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { florin } from "@/lib/bank/api";
import { displayRelationshipTierLabel } from "@/lib/bank/relationship-terminology";
import type { RecommendationPrefill } from "@/lib/bank/relationship-intelligence-types";
import type {
  CompanyLendingIntelligenceSignals,
} from "@/lib/bank/company-relationship-intelligence-types";
import type { LendingIntelligenceSignals } from "@/lib/bank/relationship-intelligence-types";
import { RelationshipIntelligencePanel } from "@/components/internal/relationship-intelligence-panel";
import { RelationshipRecommendationPanel } from "@/components/internal/relationship-recommendation-panel";
import { PreApprovalReadinessPanel } from "@/components/internal/pre-approval-readiness-panel";
import { CompanyRelationshipIntelligencePanel } from "@/components/internal/company-relationship-intelligence-integration-panel";
import { CompanyRelationshipRecommendationContextPanel } from "@/components/internal/company-relationship-recommendation-context-panel";
import type { RelationshipIntegrationBundle } from "@/lib/internal/relationship-integration.types";
import type { CompanyRelationshipIntegrationBundle } from "@/lib/internal/company-relationship-integration.types";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { useSiteContext } from "@/hooks/use-site-context";

function lendingRiskSummary(signals: LendingIntelligenceSignals | CompanyLendingIntelligenceSignals): string {
  const issues: string[] = [];
  if (signals.defaultedLoanCount > 0) {
    issues.push(`${signals.defaultedLoanCount} defaulted loan${signals.defaultedLoanCount === 1 ? "" : "s"}`);
  }
  if (signals.delinquentCardCount > 0) {
    issues.push(`${signals.delinquentCardCount} delinquent card${signals.delinquentCardCount === 1 ? "" : "s"}`);
  }
  if (signals.overdueInstallmentCount > 0) {
    issues.push(
      `${signals.overdueInstallmentCount} overdue installment${signals.overdueInstallmentCount === 1 ? "" : "s"}`,
    );
  }
  return issues.length > 0 ? issues.join(" · ") : "No active risk flags";
}

export function LendingRelationshipCompactSummary({
  integration,
}: {
  integration: ResolvedRelationshipIntegration;
}) {
  const site = useSiteContext();

  if (integration.scope === "company") {
    const { panel, recommendations } = integration.bundle;
    const recommendation = recommendations.find((row) => row.status === "ACTIVE");
    return (
      <div className="rounded-lg border border-border/60 bg-surface-2/20 px-3 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Relationship summary
          </p>
          <Link
            to="/internal/companies/$companyId"
            params={{ companyId: panel.companyId }}
            search={withInternalSiteSearch(
              { tab: "overview" as const, section: "relationship" },
              site.key,
            )}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
          >
            Details →
          </Link>
        </div>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-[12px]">
          <div>
            <dt className="text-muted-foreground">Tier · score</dt>
            <dd className="mt-0.5 tabular-nums">
              {panel.relationshipTier} · {panel.relationshipScore}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Business assets</dt>
            <dd className="mt-0.5 tabular-nums">{florin(panel.totalBusinessAssets)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Credit exposure</dt>
            <dd className="mt-0.5 tabular-nums">{florin(panel.currentCreditExposure)}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-muted-foreground">Risk</dt>
            <dd className="mt-0.5">{lendingRiskSummary(panel.lendingSignals)}</dd>
          </div>
          {recommendation ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-muted-foreground">Recommendation</dt>
              <dd className="mt-0.5">
                <span className="font-medium">{recommendation.title}</span>
                <span className="text-muted-foreground"> — {recommendation.summary}</span>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    );
  }

  const { panel, recommendations } = integration.bundle;
  const recommendation = recommendations.find((row) => row.status === "ACTIVE");

  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/20 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Relationship summary
        </p>
        <Link
          to="/internal/relationships/$userId"
          params={{ userId: panel.userId }}
          search={withInternalSiteSearch({}, site.key)}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
        >
          Details →
        </Link>
      </div>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-[12px]">
        <div>
          <dt className="text-muted-foreground">Tier · score</dt>
          <dd className="mt-0.5 tabular-nums">
            {displayRelationshipTierLabel(panel.relationshipTier, panel.relationshipScore)} ·{" "}
            {panel.relationshipScore}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Alta assets</dt>
          <dd className="mt-0.5 tabular-nums">{florin(panel.totalAltaAssets)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Credit exposure</dt>
          <dd className="mt-0.5 tabular-nums">{florin(panel.currentCreditExposure)}</dd>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <dt className="text-muted-foreground">Risk</dt>
          <dd className="mt-0.5">{lendingRiskSummary(panel.lendingSignals)}</dd>
        </div>
        {recommendation ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-muted-foreground">Recommendation</dt>
            <dd className="mt-0.5">
              <span className="font-medium">{recommendation.title}</span>
              <span className="text-muted-foreground"> — {recommendation.summary}</span>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

type AltaCardSearchDefaults = {
  tier?: AltaCardTierCode;
  limit?: number;
  rate?: number;
  recommendationId?: string;
};

export function useAltaCardSuggestedDefaults(initial?: AltaCardSearchDefaults) {
  const hasInitial =
    initial != null &&
    (initial.tier != null ||
      initial.limit != null ||
      initial.rate != null ||
      Boolean(initial.recommendationId));

  const [suggested, setSuggested] = useState<{
    tier?: AltaCardTierCode;
    limit?: number;
    rate?: number;
    recommendationId?: string;
  } | null>(hasInitial ? { ...initial } : null);

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
