"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import {
  INTERNAL_ALTA_CARD_WORKSPACE_SEARCH,
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  INTERNAL_USER_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { useState } from "react";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { AltaCardReviewIntegrationWithHook } from "@/components/internal/relationship-integration-wrappers";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { OpsAction } from "@/components/internal/ops-action";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { workspaceBreadcrumbs } from "@/components/internal/workspace/workspace-page";
import { RecordSinglePage } from "@/components/internal/workspace/record-workspace-page";
import {
  RecordMoreSection,
  RecordSummaryCard,
} from "@/components/internal/workspace/record-workspace-layout";
import {
  RecordActionGroup,
  RecordActionsSheet,
} from "@/components/internal/workspace/record-actions-sheet";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import { WorkspaceAuditLink } from "@/components/internal/workspace/workspace-audit-link";
import { RelatedRecords, type RelatedRecord } from "@/components/internal/workspace/related-records";
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
import type { InternalNoteRow } from "@/lib/internal/internal-note.types";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";
import {
  recordSectionId,
  toCaseRecordSearchParams,
  type CaseRecordSearch,
} from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";

function AltaCardReviewDecisionPanel({
  detail,
  reviewId,
  integration,
}: {
  detail: InternalAltaCardReviewDetail;
  reviewId: string;
  integration: ResolvedRelationshipIntegration | null;
}) {
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

  async function submitDecision(
    input: Omit<ProcessAltaCardReviewDecisionInput, "reviewId" | "reason">,
    reason: string,
  ) {
    await processAltaCardReviewDecision({
      data: { reviewId, reason, ...input },
    });
  }

  if (!open) {
    return (
      <RecordSummaryCard title="Decision" id={recordSectionId("decision")}>
        <OpsStatusBadge status={reviewDisplayStatusLabel(review, "internal")} />
        {review.decisionNote ? (
          <p className="mt-2 text-[13px] text-muted-foreground">{review.decisionNote}</p>
        ) : null}
      </RecordSummaryCard>
    );
  }

  return (
    <RecordSummaryCard title="Review decision" id={recordSectionId("decision")}>
      <AltaCardReviewIntegrationWithHook
        integration={integration}
        setApprovedTier={setApprovedTier}
        setApprovedLimit={setApprovedLimit}
        setApprovedRate={setApprovedRate}
      />
      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={approveLimit}
            onChange={(e) => setApproveLimit(e.target.checked)}
          />
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
          <input
            type="checkbox"
            checked={approveRate}
            onChange={(e) => setApproveRate(e.target.checked)}
          />
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
          <input
            type="checkbox"
            checked={approveTier}
            onChange={(e) => setApproveTier(e.target.checked)}
          />
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
    </RecordSummaryCard>
  );
}

export function AltaCardReviewWorkspaceView({
  detail,
  reviewId,
  integration,
  threadContext,
  threadMessages,
  auditLogs,
  notes,
  search,
}: {
  detail: InternalAltaCardReviewDetail;
  reviewId: string;
  integration: ResolvedRelationshipIntegration | null;
  threadContext: AltaCardReviewThreadContext;
  threadMessages: AltaCardReviewThreadMessageRow[];
  auditLogs: AuditLogRow[];
  notes: InternalNoteRow[];
  search: CaseRecordSearch;
}) {
  const navigate = useNavigate();
  const review = detail.review;
  const open = ["submitted", "under_review", "needs_information"].includes(review.status);
  const statusLabel = reviewDisplayStatusLabel(review, "internal");

  const relatedRecords: RelatedRecord[] = [
    {
      kind: "alta_card_review",
      id: review.id,
      label: review.applicantUsername,
      sublabel: `····${review.cardLastFour}`,
    },
    { kind: "alta_card", id: review.altaCardId, label: `Card ····${review.cardLastFour}` },
    { kind: "user", id: review.applicantUserId, label: review.applicantUsername },
    ...(review.companyId && review.companyName
      ? [{ kind: "company" as const, id: review.companyId, label: review.companyName }]
      : []),
  ];

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Inbox", to: "/internal/inbox", search: returnCtx.search },
          { label: review.applicantUsername },
        ])
      : workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Alta Card", to: "/internal/alta-card" },
          { label: review.applicantUsername },
        ]);

  const actions = (
    <RecordActionsSheet
      title="Review actions"
      description={`${review.applicantUsername} · ····${review.cardLastFour}`}
      footer={
        returnCtx?.pathname === "/internal/inbox" ? (
          <Link
            to="/internal/inbox"
            search={returnCtx.search}
            className="inline-flex h-8 w-full items-center justify-center rounded border border-border text-[12px] hover:border-border-strong"
          >
            Return to Inbox
          </Link>
        ) : null
      }
    >
      <RecordActionGroup title="Jump to">
        <div className="flex flex-wrap gap-2">
          {open ? (
            <ActionNav
              label="Record decision"
              onClick={() =>
                void navigate({
                  to: ".",
                  search: () =>
                    toCaseRecordSearchParams({
                      section: "decision",
                      from: search.from,
                    }),
                })
              }
            />
          ) : null}
          <ActionNav
            label="Open evidence"
            onClick={() =>
              void navigate({
                to: ".",
                search: () =>
                  toCaseRecordSearchParams({
                    section: "evidence",
                    from: search.from,
                  }),
              })
            }
          />
          <ActionNav
            label="Add internal note"
            onClick={() =>
              void navigate({
                to: ".",
                search: () =>
                  toCaseRecordSearchParams({
                    section: "notes",
                    from: search.from,
                  }),
              })
            }
          />
        </div>
      </RecordActionGroup>
      <RecordActionGroup title="Related">
        <div className="flex flex-col gap-1.5">
          <Link
            to="/internal/alta-card/$cardId"
            params={{ cardId: review.altaCardId }}
            search={withInternalSiteSearch(INTERNAL_ALTA_CARD_WORKSPACE_SEARCH, search.site)}
            className="text-[12px] text-gold hover:underline"
          >
            Open card
          </Link>
          <Link
            to="/internal/users/$userId"
            params={{ userId: review.applicantUserId }}
            search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
            className="text-[12px] text-gold hover:underline"
          >
            Open customer
          </Link>
          {review.companyId ? (
            <Link
              to="/internal/companies/$companyId"
              params={{ companyId: review.companyId }}
              search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open company
            </Link>
          ) : null}
        </div>
      </RecordActionGroup>
    </RecordActionsSheet>
  );

  return (
    <RecordSinglePage
      title={`Review · ${review.applicantUsername}`}
      breadcrumbs={breadcrumbs}
      recordType="Alta Card review"
      primaryId={<>····{review.cardLastFour}</>}
      status={statusLabel}
      meta={
        <>
          <span>{ALTA_CARD_TIER_LABELS[review.currentTier]}</span>
          <span className="type-finance tabular-nums">
            {formatAltaCardCurrency(review.currentLimit)}
          </span>
        </>
      }
      warning={
        open ? (
          <span className="text-[12px] text-amber-700 dark:text-amber-300">Needs a decision</span>
        ) : null
      }
      headerActions={actions}
      search={search}
    >
      <div className="space-y-3">
        <AltaCardReviewDecisionPanel
          detail={detail}
          reviewId={reviewId}
          integration={integration}
        />

        <RecordSummaryCard title="Current terms" id={recordSectionId("summary")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Cardholder">
              <Link
                to="/internal/users/$userId"
                params={{ userId: review.applicantUserId }}
                search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                className="break-words hover:text-gold"
              >
                {review.applicantUsername}
              </Link>
            </WorkspaceField>
            <WorkspaceField label="Card">····{review.cardLastFour}</WorkspaceField>
            <WorkspaceField label="Tier">{ALTA_CARD_TIER_LABELS[review.currentTier]}</WorkspaceField>
            <WorkspaceField label="Limit">
              <span className="type-finance tabular-nums">
                {formatAltaCardCurrency(review.currentLimit)}
              </span>
            </WorkspaceField>
            <WorkspaceField label="Rate">{formatAltaCardRate(review.currentRate)}</WorkspaceField>
            <WorkspaceField label="Status">
              <OpsStatusBadge status={statusLabel} />
            </WorkspaceField>
            {review.requestLimitIncrease ? (
              <WorkspaceField label="Requested limit">
                {formatAltaCardCurrency(review.requestedLimit ?? 0)}
              </WorkspaceField>
            ) : null}
            {review.requestRateReduction ? (
              <WorkspaceField label="Requested rate">
                {formatAltaCardRate(review.requestedRate ?? 0)}
              </WorkspaceField>
            ) : null}
            {review.requestTierUpgrade && review.requestedTier ? (
              <WorkspaceField label="Requested tier">
                {ALTA_CARD_TIER_LABELS[review.requestedTier]}
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
          <Link
            to="/internal/alta-card/$cardId"
            params={{ cardId: review.altaCardId }}
            search={withInternalSiteSearch(INTERNAL_ALTA_CARD_WORKSPACE_SEARCH, search.site)}
            className="mt-3 inline-block text-[12px] text-gold hover:underline"
          >
            Open card workspace →
          </Link>
        </RecordSummaryCard>

        <RecordSummaryCard title="Evidence" id={recordSectionId("evidence")}>
          <div className="min-h-[420px] overflow-hidden rounded-lg border border-border/60">
            <LoanApplicationThreadView
              className="h-[420px]"
              context={mapAltaCardReviewThreadContextToLoan(threadContext)}
              messages={mapAltaCardReviewThreadMessagesToLoan(threadMessages)}
              variant="internal"
              product="alta-card-review"
              backTo="/internal/alta-card/reviews/$reviewId"
              backParams={{ reviewId }}
              backLabel="← Review workspace"
            />
          </div>
        </RecordSummaryCard>

        <RecordSummaryCard title="Related records" id={recordSectionId("related")}>
          <RelatedRecords records={relatedRecords} site={search.site} />
        </RecordSummaryCard>

        <div className="space-y-2">
          <RecordMoreSection
            id={recordSectionId("notes")}
            title="Internal notes"
            defaultOpen={search.section === "notes"}
          >
            <p className="mb-2 text-[12px] text-muted-foreground">
              Surfaced from the cardholder customer profile.
            </p>
            <InternalNotePanel
              targetType="USER"
              targetId={review.applicantUserId}
              initialNotes={notes}
            />
          </RecordMoreSection>
          <RecordMoreSection
            id={recordSectionId("audit")}
            title="Audit history"
            defaultOpen={search.section === "audit"}
          >
            <WorkspaceAuditLink entityType="ALTA_CARD" entityId={review.altaCardId} />
            <div className="mt-2">
              <InternalAuditTable rows={auditLogs} />
            </div>
          </RecordMoreSection>
          <RecordMoreSection
            id={recordSectionId("technical")}
            title="Technical details"
            defaultOpen={search.section === "technical"}
          >
            <WorkspaceFieldGrid columns={2}>
              <WorkspaceField label="Review ID">
                <span className="break-all font-mono text-[11px]">{review.id}</span>
              </WorkspaceField>
              <WorkspaceField label="Card ID">
                <span className="break-all font-mono text-[11px]">{review.altaCardId}</span>
              </WorkspaceField>
              <WorkspaceField label="Card last four">
                <span className="font-mono text-[11px]">····{review.cardLastFour}</span>
              </WorkspaceField>
              <WorkspaceField label="Applicant user ID">
                <span className="break-all font-mono text-[11px]">{review.applicantUserId}</span>
              </WorkspaceField>
              {review.companyId ? (
                <WorkspaceField label="Company ID">
                  <span className="break-all font-mono text-[11px]">{review.companyId}</span>
                </WorkspaceField>
              ) : null}
              <WorkspaceField label="Raw status">
                <span className="font-mono text-[11px]">{review.status}</span>
              </WorkspaceField>
            </WorkspaceFieldGrid>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Full card numbers and CVV are never shown here.
            </p>
          </RecordMoreSection>
        </div>
      </div>
    </RecordSinglePage>
  );
}

function ActionNav({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-border px-2.5 py-1.5 text-left text-[12px] hover:border-border-strong"
    >
      {label}
    </button>
  );
}
