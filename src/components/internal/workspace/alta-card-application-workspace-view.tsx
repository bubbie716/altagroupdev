"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import {
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  INTERNAL_USER_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { useState } from "react";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { AltaCardApplicationIntegration } from "@/components/internal/relationship-integration-wrappers";
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
  ALTA_CARD_APPLICATION_STATUS_LABELS,
} from "@/lib/bank/alta-card-application-thread-types";
import {
  ALTA_CARD_TIER_LABELS,
  formatAltaCardCurrency,
  formatAltaCardRate,
  type AltaCardTierCode,
  type InternalAltaCardApplicationReviewContext,
} from "@/lib/bank/alta-card-types";
import {
  approveAltaCardApplicationRecord,
  denyAltaCardApplicationRecord,
} from "@/lib/bank/alta-card.functions";
import { updateAltaCardApplicationStatusRecord } from "@/lib/bank/alta-card-application.functions";
import {
  mapAltaCardThreadContextToLoan,
  mapAltaCardThreadMessagesToLoan,
} from "@/lib/bank/alta-card-thread-adapter";
import type { AuditLogRow } from "@/lib/internal/audit.types";
import type { InternalNoteRow } from "@/lib/internal/internal-note.types";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";
import { isAdmin } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  recordSectionId,
  toCaseRecordSearchParams,
  type CaseRecordSearch,
} from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";

function AltaCardApplicationDecisionPanel({
  review,
  integration,
}: {
  review: InternalAltaCardApplicationReviewContext;
  integration: ResolvedRelationshipIntegration | null;
}) {
  const user = useCurrentUser();
  const admin = user ? isAdmin(user) : false;
  const app = review.application;
  const open = ["submitted", "under_review", "needs_info"].includes(app.status);

  const [tier, setTier] = useState(app.approvedTier ?? app.requestedTier);
  const [limit, setLimit] = useState(String(app.approvedLimit ?? app.requestedLimit ?? 5000));
  const [rate, setRate] = useState(String(app.approvedInterestRate ?? 19.99));
  const [notesText, setNotesText] = useState(app.reviewNote ?? "");
  const [denialReason, setDenialReason] = useState("");
  const [activateNow, setActivateNow] = useState(false);

  if (!open) {
    return (
      <RecordSummaryCard title="Decision" id={recordSectionId("decision")}>
        <OpsStatusBadge status={ALTA_CARD_APPLICATION_STATUS_LABELS[app.status]} />
        {app.approvedLimit ? (
          <p className="mt-2 text-[13px]">
            Approved: {formatAltaCardCurrency(app.approvedLimit)}
            {app.approvedTier ? ` · ${ALTA_CARD_TIER_LABELS[app.approvedTier]}` : ""}
            {app.approvedInterestRate != null
              ? ` · ${formatAltaCardRate(app.approvedInterestRate)}`
              : ""}
          </p>
        ) : null}
        {app.denialReason ? (
          <p className="mt-2 text-[12px] text-muted-foreground">{app.denialReason}</p>
        ) : null}
        {app.reviewNote ? (
          <p className="mt-2 text-[12px] text-muted-foreground">{app.reviewNote}</p>
        ) : null}
      </RecordSummaryCard>
    );
  }

  return (
    <RecordSummaryCard title="Underwriting decision" id={recordSectionId("decision")}>
      <AltaCardApplicationIntegration
        integration={integration}
        onPrefill={({ tier: t, limit: l, rate: r }) => {
          if (t) setTier(t);
          if (l) setLimit(String(l));
          if (r) setRate(String(r));
        }}
      />
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-1">
          <OpsAction
            label="Under review"
            title="Mark under review"
            description="Updates application status and notifies the applicant."
            onConfirm={async () => {
              await updateAltaCardApplicationStatusRecord({
                data: { applicationId: app.id, status: "under_review" },
              });
            }}
          />
          <OpsAction
            label="Request info"
            title="Request additional information"
            description="Asks the applicant for more details via the deal room."
            onConfirm={async () => {
              await updateAltaCardApplicationStatusRecord({
                data: { applicationId: app.id, status: "needs_info" },
              });
            }}
          />
        </div>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as AltaCardTierCode)}
          className="w-full rounded border border-border bg-surface-1 px-2 py-1 text-[13px]"
        >
          {Object.entries(ALTA_CARD_TIER_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          className="w-full rounded border border-border px-2 py-1 font-mono text-[12px]"
          placeholder="Approved limit"
        />
        <input
          type="number"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-full rounded border border-border px-2 py-1 font-mono text-[12px]"
          placeholder="Interest rate %"
        />
        <textarea
          value={notesText}
          onChange={(e) => setNotesText(e.target.value)}
          placeholder="Review notes"
          className="w-full rounded border border-border px-2 py-1 text-[13px]"
          rows={2}
        />
        {admin ? (
          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={activateNow}
              onChange={(e) => setActivateNow(e.target.checked)}
            />
            Approve and activate immediately
          </label>
        ) : null}
        <OpsAction
          label="Approve"
          variant="primary"
          title="Approve Alta Card application"
          description="Records approved terms and notifies the applicant."
          impact={`${ALTA_CARD_TIER_LABELS[tier]} · ${formatAltaCardCurrency(Number(limit))} · ${formatAltaCardRate(Number(rate))}`}
          onConfirm={async (reason) => {
            await approveAltaCardApplicationRecord({
              data: {
                applicationId: app.id,
                approvedLimit: Number(limit),
                interestRate: Number(rate),
                tier,
                reviewNote: notesText.trim() || reason,
                approveAndActivate: activateNow || undefined,
              },
            });
          }}
        />
        <textarea
          value={denialReason}
          onChange={(e) => setDenialReason(e.target.value)}
          placeholder="Denial reason (required for deny)"
          className="w-full rounded border border-border px-2 py-1 text-[13px]"
          rows={2}
        />
        <OpsAction
          label="Deny"
          variant="danger"
          title="Deny Alta Card application"
          description="Closes the application with a recorded denial reason."
          disabled={!denialReason.trim()}
          onConfirm={async (reason) => {
            await denyAltaCardApplicationRecord({
              data: { applicationId: app.id, denialReason: denialReason.trim() || reason },
            });
          }}
        />
      </div>
    </RecordSummaryCard>
  );
}

export function AltaCardApplicationWorkspaceView({
  review,
  integration,
  auditLogs,
  notes,
  search,
  applicationId,
}: {
  review: InternalAltaCardApplicationReviewContext;
  integration: ResolvedRelationshipIntegration | null;
  auditLogs: AuditLogRow[];
  notes: InternalNoteRow[];
  search: CaseRecordSearch;
  applicationId: string;
}) {
  const navigate = useNavigate();
  const app = review.application;
  const open = ["submitted", "under_review", "needs_info"].includes(app.status);
  const statusLabel = ALTA_CARD_APPLICATION_STATUS_LABELS[app.status];

  const relatedRecords: RelatedRecord[] = [
    {
      kind: "alta_card_application",
      id: app.id,
      label: app.applicantUsername,
      sublabel: statusLabel,
    },
    { kind: "user", id: app.applicantUserId, label: app.applicantUsername },
    ...(app.companyId && app.companyName
      ? [{ kind: "company" as const, id: app.companyId, label: app.companyName }]
      : []),
    ...(app.cardId
      ? [{ kind: "alta_card" as const, id: app.cardId, label: "Issued card" }]
      : []),
  ];

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Inbox", to: "/internal/inbox", search: returnCtx.search },
          { label: app.applicantUsername },
        ])
      : workspaceBreadcrumbs([
          { label: "Home", to: "/internal" },
          { label: "Alta Card", to: "/internal/alta-card" },
          { label: app.applicantUsername },
        ]);

  const actions = (
    <RecordActionsSheet
      title="Application actions"
      description={`${app.applicantUsername} · ${statusLabel}`}
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
            to="/internal/users/$userId"
            params={{ userId: app.applicantUserId }}
            search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
            className="text-[12px] text-gold hover:underline"
          >
            Open customer
          </Link>
          {app.companyId ? (
            <Link
              to="/internal/companies/$companyId"
              params={{ companyId: app.companyId }}
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
      title={app.applicantUsername}
      breadcrumbs={breadcrumbs}
      recordType="Alta Card application"
      primaryId={
        <>
          {ALTA_CARD_TIER_LABELS[app.requestedTier]}
          {app.requestedLimit != null
            ? ` · ${formatAltaCardCurrency(app.requestedLimit)}`
            : ""}
        </>
      }
      status={statusLabel}
      meta={
        <>
          <span>{app.cardType}</span>
          <span className="font-mono">{formatActivityDateTime(app.createdAt)}</span>
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
        <AltaCardApplicationDecisionPanel review={review} integration={integration} />

        <RecordSummaryCard title="Summary" id={recordSectionId("summary")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Applicant">
              <Link
                to="/internal/users/$userId"
                params={{ userId: app.applicantUserId }}
                search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                className="break-words hover:text-gold"
              >
                {app.applicantUsername}
              </Link>
            </WorkspaceField>
            <WorkspaceField label="Company">
              {app.companyId ? (
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId: app.companyId }}
                  search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                  className="break-words hover:text-gold"
                >
                  {app.companyName ?? app.companyId}
                </Link>
              ) : (
                "Personal"
              )}
            </WorkspaceField>
            <WorkspaceField label="Card type">{app.cardType}</WorkspaceField>
            <WorkspaceField label="Status">
              <OpsStatusBadge status={statusLabel} />
            </WorkspaceField>
            <WorkspaceField label="Requested tier">
              {ALTA_CARD_TIER_LABELS[app.requestedTier]}
            </WorkspaceField>
            <WorkspaceField label="Requested limit">
              {formatAltaCardCurrency(app.requestedLimit ?? 0)}
            </WorkspaceField>
            <WorkspaceField label="Applicant accounts">{review.applicantAccountCount}</WorkspaceField>
            <WorkspaceField label="Applicant loans">{review.applicantLoanCount}</WorkspaceField>
            {app.expectedMonthlySpend != null ? (
              <WorkspaceField label="Expected monthly spend">
                {formatAltaCardCurrency(app.expectedMonthlySpend)}
              </WorkspaceField>
            ) : null}
            {app.purpose ? (
              <WorkspaceField label="Purpose" className="sm:col-span-2 lg:col-span-3">
                {app.purpose}
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="Evidence" id={recordSectionId("evidence")}>
          <div className="min-h-[420px] overflow-hidden rounded-lg border border-border/60">
            <LoanApplicationThreadView
              className="h-[420px]"
              context={mapAltaCardThreadContextToLoan(review.threadContext)}
              messages={mapAltaCardThreadMessagesToLoan(review.messages)}
              variant="internal"
              product="alta-card"
              backTo="/internal/alta-card/applications/$applicationId"
              backParams={{ applicationId }}
              backLabel="← Application workspace"
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
              Card notes use the owner customer profile until ALTA_CARD note targets are supported.
            </p>
            <InternalNotePanel
              targetType="USER"
              targetId={app.applicantUserId}
              initialNotes={notes}
            />
          </RecordMoreSection>
          <RecordMoreSection
            id={recordSectionId("audit")}
            title="Audit history"
            defaultOpen={search.section === "audit"}
          >
            <WorkspaceAuditLink entityType="ALTA_CARD" entityId={app.id} />
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
              <WorkspaceField label="Application ID">
                <span className="break-all font-mono text-[11px]">{app.id}</span>
              </WorkspaceField>
              <WorkspaceField label="Applicant user ID">
                <span className="break-all font-mono text-[11px]">{app.applicantUserId}</span>
              </WorkspaceField>
              {app.companyId ? (
                <WorkspaceField label="Company ID">
                  <span className="break-all font-mono text-[11px]">{app.companyId}</span>
                </WorkspaceField>
              ) : null}
              {app.paymentSourceAccountId ? (
                <WorkspaceField label="Payment source account ID">
                  <span className="break-all font-mono text-[11px]">{app.paymentSourceAccountId}</span>
                </WorkspaceField>
              ) : null}
              {app.cardId ? (
                <WorkspaceField label="Issued card ID">
                  <span className="break-all font-mono text-[11px]">{app.cardId}</span>
                </WorkspaceField>
              ) : null}
              <WorkspaceField label="Created">
                <span className="font-mono text-[11px]">{formatActivityDateTime(app.createdAt)}</span>
              </WorkspaceField>
              <WorkspaceField label="Updated">
                <span className="font-mono text-[11px]">{formatActivityDateTime(app.updatedAt)}</span>
              </WorkspaceField>
              {app.reviewedAt ? (
                <WorkspaceField label="Reviewed">
                  <span className="font-mono text-[11px]">
                    {formatActivityDateTime(app.reviewedAt)}
                  </span>
                </WorkspaceField>
              ) : null}
            </WorkspaceFieldGrid>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Card numbers and CVV are never shown here.
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
