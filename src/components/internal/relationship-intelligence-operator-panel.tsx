"use client";

import { florin } from "@/lib/bank/api";
import {
  altaPrivateStatusLabel,
  displayRelationshipTierLabel,
} from "@/lib/bank/relationship-terminology";
import type {
  RelationshipIntelligencePanelData,
  RelationshipRecommendationRow,
  RelationshipTimelineEventRow,
} from "@/lib/bank/relationship-intelligence-types";
import { RelationshipIntelligencePanel } from "@/components/internal/relationship-intelligence-panel";
import { RelationshipRecommendationPanel } from "@/components/internal/relationship-recommendation-panel";
import { RelationshipProductHoldingsPanel } from "@/components/internal/relationship-product-holdings-panel";
import { PreApprovalReadinessPanel } from "@/components/internal/pre-approval-readiness-panel";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { Link } from "@tanstack/react-router";
import { AltaPrivateAdminPanel } from "@/components/internal/alta-private-admin-panel";
import type { AltaPrivateInternalSummary } from "@/lib/bank/alta-private-types";

export function PrivateBankingIntelligencePanel({
  panel,
  recommendations,
}: {
  panel: RelationshipIntelligencePanelData;
  recommendations: RelationshipRecommendationRow[];
}) {
  const invite = recommendations.find((r) => r.recommendationType === "PRIVATE_BANKING_INVITE");

  return (
    <section className="rounded-xl border border-gold/30 bg-gold/5 p-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Alta Private — program status
      </h3>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-[14px]">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Alta Private eligibility
          </dt>
          <dd className="mt-1 font-medium">{panel.privateBankingEligible ? "Eligible" : "Not eligible"}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Alta Private membership
          </dt>
          <dd className="mt-1 font-medium">
            {altaPrivateStatusLabel(panel.privateBankingClient, panel.privateBankingEligible)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Relationship score</dt>
          <dd className="mt-1 tabular-nums">{panel.relationshipScore}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Total Alta assets</dt>
          <dd className="mt-1 tabular-nums">{florin(panel.totalAltaAssets)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Relationship tier</dt>
          <dd className="mt-1">
            {displayRelationshipTierLabel(panel.relationshipTier, panel.relationshipScore)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Product mix</dt>
          <dd className="mt-1">
            {[
              panel.productsHeld.activeBankAccounts > 0 ? "Banking" : null,
              panel.productsHeld.activeAltaCards > 0 ? "Alta Card" : null,
              panel.productsHeld.activeLoans > 0 ? "Lending" : null,
              panel.productsHeld.businessCompanies > 0 ? "Business" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </dd>
        </div>
      </dl>
      {invite ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          Relationship Intelligence recommendation: {invite.title} ({invite.confidenceScore}% confidence)
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/internal/users/$userId"
          params={{ userId: panel.userId }}
          search={{ tab: "relationship" }}
          className="rounded border border-gold/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:bg-gold/10"
        >
          Alta Private membership panel
        </Link>
        <Link
          to="/internal/relationships/$userId"
          params={{ userId: panel.userId }}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground hover:underline"
        >
          Relationship history →
        </Link>
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">
        Alta Private membership is invitation-only. Send invitations from the Relationship tab after review.
      </p>
    </section>
  );
}

export function RelationshipIntelligenceOperatorPanel({
  userId,
  panel,
  recommendations,
  timelinePreview,
  preApprovalReadiness,
  altaCardId,
  altaPrivateSummary,
  canManageInvitations,
}: {
  userId: string;
  panel: RelationshipIntelligencePanelData;
  recommendations: RelationshipRecommendationRow[];
  timelinePreview: RelationshipTimelineEventRow[];
  preApprovalReadiness: PreApprovalReadiness | null;
  altaCardId?: string | null;
  altaPrivateSummary?: AltaPrivateInternalSummary;
  canManageInvitations?: boolean;
}) {
  return (
    <div className="space-y-6">
      <RelationshipIntelligencePanel panel={panel} context="CUSTOMER_PROFILE" showLendingSignals />

      <div className="grid gap-4 lg:grid-cols-2">
        <RelationshipProductHoldingsPanel holdings={panel.productHoldings} />
        <RelationshipRecommendationPanel
          userId={userId}
          context="CUSTOMER_PROFILE"
          recommendations={recommendations}
          compact
        />
      </div>

      {preApprovalReadiness ? <PreApprovalReadinessPanel readiness={preApprovalReadiness} /> : null}

      <PrivateBankingIntelligencePanel panel={panel} recommendations={recommendations} />

      {altaPrivateSummary ? (
        <AltaPrivateAdminPanel
          userId={userId}
          summary={altaPrivateSummary}
          canManageInvitations={canManageInvitations ?? false}
        />
      ) : null}

      <section className="rounded-xl border border-border bg-surface-1/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Timeline preview
          </h3>
          <Link
            to="/internal/relationships/$userId"
            params={{ userId }}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
          >
            Full timeline →
          </Link>
        </div>
        {timelinePreview.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted-foreground">No timeline events yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-[13px]">
            {timelinePreview.slice(0, 5).map((event) => (
              <li key={event.id} className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                <span>{event.title}</span>
                <span className="font-mono text-[10px]">{formatActivityDateTime(event.occurredAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface-1/80 p-5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Quick links</h3>
        <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-[0.14em]">
          <Link to="/internal/relationships/$userId" params={{ userId }} className="text-gold hover:underline">
            Relationship profile
          </Link>
          {altaCardId ? (
            <Link to="/internal/alta-card/$cardId" params={{ cardId: altaCardId }} className="text-gold hover:underline">
              Alta Card
            </Link>
          ) : (
            <Link to="/internal/alta-card/applications" className="text-gold hover:underline">
              Alta Card applications
            </Link>
          )}
          <Link to="/internal/lending" className="text-gold hover:underline">
            Lending queue
          </Link>
          <Link to="/internal/bank/accounts" className="text-gold hover:underline">
            Bank accounts
          </Link>
          <Link to="/internal/bank/alta-pay" className="text-gold hover:underline">
            Alta Pay
          </Link>
          <Link to="/internal/users/$userId" params={{ userId }} search={{ privateReview: true }} className="text-gold hover:underline">
            Alta Private review
          </Link>
        </div>
      </section>
    </div>
  );
}
