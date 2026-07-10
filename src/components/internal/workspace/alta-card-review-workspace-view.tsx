"use client";

import { Link } from "@tanstack/react-router";
import { INTERNAL_ALTA_CARD_WORKSPACE_SEARCH } from "@/lib/internal/internal-route-search";
import { useState } from "react";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { AltaCardReviewIntegrationWithHook } from "@/components/internal/relationship-integration-wrappers";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { OpsAction } from "@/components/internal/ops-action";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import {
  WorkspacePage,
  workspaceBreadcrumbs,
  WorkspaceSidebar,
  WorkspaceFieldGrid,
  WorkspaceField,
  WorkspaceSection,
  formatRelationshipTier,
  type RelatedRecord,
} from "@/components/internal/workspace";
import { WorkspaceAuditLink } from "@/components/internal/workspace/workspace-audit-link";
import type { WorkspaceTab } from "@/components/internal/console/workspace-layout";
import {
  ALTA_CARD_TIER_LABELS,
  formatAltaCardCurrency,
  formatAltaCardRate,
  type AltaCardTierCode,
} from "@/lib/bank/alta-card-types";
import type { ProcessAltaCardReviewDecisionInput } from "@/lib/bank/alta-card-review-types";
import type { InternalAltaCardReviewDetail } from "@/lib/bank/alta-card-review-types";
import { processAltaCardReviewDecision } from "@/lib/bank/alta-card-review.functions";
import {
  mapAltaCardReviewThreadContextToLoan,
  mapAltaCardReviewThreadMessagesToLoan,
} from "@/lib/bank/alta-card-review-thread-adapter";
import type {
  AltaCardReviewThreadContext,
  AltaCardReviewThreadMessageRow,
} from "@/lib/bank/alta-card-review-thread-types";
import { reviewDisplayStatusLabel } from "@/lib/bank/alta-card-review-helpers";
import type { AuditLogRow } from "@/lib/internal/audit.types";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";
import { isAdmin } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";

export function AltaCardReviewWorkspaceView({
  detail,
  reviewId,
  integration,
  threadContext,
  threadMessages,
  auditLogs,
  notes,
  activeTab,
}: {
  detail: InternalAltaCardReviewDetail;
  reviewId: string;
  integration: ResolvedRelationshipIntegration | null;
  threadContext: AltaCardReviewThreadContext;
  threadMessages: AltaCardReviewThreadMessageRow[];
  auditLogs: AuditLogRow[];
  notes: Array<{ id: string; body: string; authorUsername: string; createdAt: string }>;
  activeTab: string;
}) {
  const user = useCurrentUser();
  const admin = user ? isAdmin(user) : false;
  const review = detail.review;
  const rel = detail.relationship;
  const open = ["submitted", "under_review", "needs_information"].includes(review.status);

  const [approveLimit, setApproveLimit] = useState(review.requestLimitIncrease);
  const [approvedLimit, setApprovedLimit] = useState(
    String(review.requestedLimit ?? rel?.recommendedCreditLimit ?? review.currentLimit),
  );
  const [approveRate, setApproveRate] = useState(review.requestRateReduction);
  const [approvedRate, setApprovedRate] = useState(
    String(review.requestedRate ?? rel?.recommendedInterestRate ?? review.currentRate),
  );
  const [approveTier, setApproveTier] = useState(review.requestTierUpgrade);
  const [approvedTier, setApprovedTier] = useState<AltaCardTierCode>(
    review.requestedTier ?? rel?.recommendedTier ?? review.currentTier,
  );
  const [goldOverride, setGoldOverride] = useState(false);

  async function submitDecision(
    input: Omit<ProcessAltaCardReviewDecisionInput, "reviewId" | "reason">,
    reason: string,
  ) {
    await processAltaCardReviewDecision({
      data: { reviewId, reason, ...input },
    });
  }

  const relatedRecords: RelatedRecord[] = [
    { kind: "alta_card_review", id: review.id, label: review.applicantUsername, sublabel: `····${review.cardLastFour}` },
    { kind: "alta_card", id: review.altaCardId, label: `Card ····${review.cardLastFour}` },
    { kind: "user", id: review.applicantUserId, label: review.applicantUsername },
    ...(review.companyId && review.companyName
      ? [{ kind: "company" as const, id: review.companyId, label: review.companyName }]
      : []),
  ];

  const decisionPanel = open ? (
    <WorkspaceSection title="Review decision">
      <AltaCardReviewIntegrationWithHook
        integration={integration}
        setApprovedTier={setApprovedTier}
        setApprovedLimit={setApprovedLimit}
        setApprovedRate={setApprovedRate}
      />
      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={approveLimit} onChange={(e) => setApproveLimit(e.target.checked)} />
          Approve limit increase
        </label>
        {approveLimit ? (
          <input
            type="number"
            value={approvedLimit}
            onChange={(e) => setApprovedLimit(e.target.value)}
            className="w-full rounded border border-border px-2 py-1 font-mono text-[12px]"
          />
        ) : null}
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={approveRate} onChange={(e) => setApproveRate(e.target.checked)} />
          Approve rate reduction
        </label>
        {approveRate ? (
          <input
            type="number"
            step="0.01"
            value={approvedRate}
            onChange={(e) => setApprovedRate(e.target.value)}
            className="w-full rounded border border-border px-2 py-1 font-mono text-[12px]"
          />
        ) : null}
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={approveTier} onChange={(e) => setApproveTier(e.target.checked)} />
          Approve tier upgrade
        </label>
        {approveTier ? (
          <select
            value={approvedTier}
            onChange={(e) => setApprovedTier(e.target.value as AltaCardTierCode)}
            className="w-full rounded border border-border px-2 py-1 text-[13px]"
          >
            {(["white", "navy", "black", "gold"] as AltaCardTierCode[]).map((tier) => (
              <option key={tier} value={tier}>
                {ALTA_CARD_TIER_LABELS[tier]}
              </option>
            ))}
          </select>
        ) : null}
        {admin && approvedTier === "gold" ? (
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={goldOverride} onChange={(e) => setGoldOverride(e.target.checked)} />
            Gold override (non-private)
          </label>
        ) : null}
        <div className="flex flex-wrap gap-1 pt-2">
          <OpsAction
            label="Approve"
            variant="primary"
            title="Approve review changes"
            description="Applies selected term changes to the card."
            onConfirm={async (reason) => {
              if (!approveLimit && !approveRate && !approveTier) {
                throw new Error("Select at least one term to approve.");
              }
              await submitDecision(
                {
                  action: "approve",
                  approveLimitIncrease: approveLimit,
                  approvedLimit: approveLimit ? Number(approvedLimit) : undefined,
                  approveRateReduction: approveRate,
                  approvedRate: approveRate ? Number(approvedRate) : undefined,
                  approveTierUpgrade: approveTier,
                  approvedTier: approveTier ? approvedTier : undefined,
                  goldOverride,
                },
                reason,
              );
            }}
          />
          <OpsAction
            label="Deny"
            variant="danger"
            title="Deny review request"
            description="Denies all requested changes."
            onConfirm={async (reason) => {
              await submitDecision({ action: "deny" }, reason);
            }}
          />
          <OpsAction
            label="Close review"
            title="Close review"
            description="Closes the review without approving changes."
            onConfirm={async (reason) => {
              await processAltaCardReviewDecision({
                data: { reviewId, action: "cancel", reason },
              });
            }}
          />
        </div>
      </div>
    </WorkspaceSection>
  ) : (
    <WorkspaceSection title="Decision">
      <OpsStatusBadge status={reviewDisplayStatusLabel(review, "internal")} />
      {review.decisionNote ? (
        <p className="mt-2 text-[13px] text-muted-foreground">{review.decisionNote}</p>
      ) : null}
    </WorkspaceSection>
  );

  const tabs: WorkspaceTab[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <WorkspaceSection title="Current terms">
          <WorkspaceFieldGrid columns={4}>
            <WorkspaceField label="Cardholder">{review.applicantUsername}</WorkspaceField>
            <WorkspaceField label="Card">····{review.cardLastFour}</WorkspaceField>
            <WorkspaceField label="Tier">{ALTA_CARD_TIER_LABELS[review.currentTier]}</WorkspaceField>
            <WorkspaceField label="Limit">{formatAltaCardCurrency(review.currentLimit)}</WorkspaceField>
            <WorkspaceField label="Rate">{formatAltaCardRate(review.currentRate)}</WorkspaceField>
            <WorkspaceField label="Status">
              <OpsStatusBadge status={reviewDisplayStatusLabel(review, "internal")} />
            </WorkspaceField>
          </WorkspaceFieldGrid>
          <Link
            to="/internal/alta-card/$cardId"
            params={{ cardId: review.altaCardId }}
            search={INTERNAL_ALTA_CARD_WORKSPACE_SEARCH}
            className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.12em] text-gold hover:underline"
          >
            Open card workspace →
          </Link>
        </WorkspaceSection>
      ),
    },
    {
      id: "thread",
      label: "Deal Room",
      content: (
        <div className="min-h-[520px] overflow-hidden rounded-lg border border-border/60">
          <LoanApplicationThreadView
            className="h-[520px]"
            context={mapAltaCardReviewThreadContextToLoan(threadContext)}
            messages={mapAltaCardReviewThreadMessagesToLoan(threadMessages)}
            variant="internal"
            product="alta-card-review"
            backTo="/internal/alta-card/reviews/$reviewId"
            backParams={{ reviewId }}
            backLabel="← Review workspace"
          />
        </div>
      ),
    },
    { id: "decision", label: "Decision", content: decisionPanel },
    {
      id: "audit",
      label: "Audit",
      content: (
        <>
          <WorkspaceAuditLink entityType="ALTA_CARD" entityId={review.altaCardId} />
          <InternalAuditTable rows={auditLogs} />
        </>
      ),
    },
    {
      id: "notes",
      label: "Notes",
      content: (
        <div className="space-y-3">
          <p className="text-[12px] text-muted-foreground">
            Surfaced from the cardholder customer profile.
          </p>
          <InternalNotePanel targetType="USER" targetId={review.applicantUserId} initialNotes={notes} />
        </div>
      ),
    },
  ];

  return (
    <WorkspacePage
      title={`Review · ${review.applicantUsername}`}
      status={reviewDisplayStatusLabel(review, "internal")}
      breadcrumbs={workspaceBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Deal Rooms", to: "/internal/queues/deal-rooms" },
        { label: review.applicantUsername },
      ])}
      tabs={tabs}
      activeTabId={activeTab}
      sidebar={
        <WorkspaceSidebar
          quickActions={
            <>
              <Link
                to="/internal/alta-card/reviews/$reviewId"
                params={{ reviewId }}
                search={{ tab: "thread" }}
                className="rounded border border-gold/30 px-2 py-1 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
              >
                Open deal room
              </Link>
              {open ? (
                <Link
                  to="/internal/alta-card/reviews/$reviewId"
                  params={{ reviewId }}
                  search={{ tab: "decision" }}
                  className="rounded border border-border px-2 py-1 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                >
                  Record decision
                </Link>
              ) : null}
            </>
          }
          relatedRecords={relatedRecords}
          auditRows={auditLogs}
          notes={notes}
          relationship={
            integration?.scope === "personal"
              ? {
                  score: integration.bundle.panel.relationshipScore,
                  tier: formatRelationshipTier(integration.bundle.panel.relationshipTier),
                  totalAssets: integration.bundle.panel.totalAltaAssets,
                  href: `/internal/users/${review.applicantUserId}?tab=relationship`,
                }
              : null
          }
        />
      }
    />
  );
}
