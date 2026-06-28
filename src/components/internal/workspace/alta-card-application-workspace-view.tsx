"use client";

import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { AltaCardApplicationIntegration } from "@/components/internal/relationship-integration-wrappers";
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
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";
import { isAdmin } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";

export function AltaCardApplicationWorkspaceView({
  review,
  integration,
  auditLogs,
  notes,
  activeTab,
  applicationId,
}: {
  review: InternalAltaCardApplicationReviewContext;
  integration: ResolvedRelationshipIntegration | null;
  auditLogs: AuditLogRow[];
  notes: Array<{ id: string; body: string; authorUsername: string; createdAt: string }>;
  activeTab: string;
  applicationId: string;
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
  const [goldOverride, setGoldOverride] = useState(false);
  const [activateNow, setActivateNow] = useState(false);

  const relatedRecords: RelatedRecord[] = [
    {
      kind: "alta_card_application",
      id: app.id,
      label: app.applicantUsername,
      sublabel: ALTA_CARD_APPLICATION_STATUS_LABELS[app.status],
    },
    { kind: "user", id: app.applicantUserId, label: app.applicantUsername },
    ...(app.companyId && app.companyName
      ? [{ kind: "company" as const, id: app.companyId, label: app.companyName }]
      : []),
  ];

  const decisionPanel = open ? (
    <WorkspaceSection title="Underwriting decision">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1">
          <OpsAction
            label="Under review"
            title="Mark under review"
            description="Updates application status and notifies the applicant."
            onConfirm={async (reason) => {
              await updateAltaCardApplicationStatusRecord({
                data: { applicationId: app.id, status: "under_review" },
              });
            }}
          />
          <OpsAction
            label="Request info"
            title="Request additional information"
            description="Asks the applicant for more details via the deal room."
            onConfirm={async (reason) => {
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
        {tier === "gold" && admin ? (
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={goldOverride} onChange={(e) => setGoldOverride(e.target.checked)} />
            Gold override (non–private client)
          </label>
        ) : null}
        {admin ? (
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={activateNow} onChange={(e) => setActivateNow(e.target.checked)} />
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
                goldOverride: goldOverride || undefined,
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
    </WorkspaceSection>
  ) : (
    <WorkspaceSection title="Decision">
      <OpsStatusBadge status={ALTA_CARD_APPLICATION_STATUS_LABELS[app.status]} />
      {app.approvedLimit ? (
        <p className="mt-2 text-[13px]">
          Approved: {formatAltaCardCurrency(app.approvedLimit)} ·{" "}
          {app.approvedTier ? ALTA_CARD_TIER_LABELS[app.approvedTier] : ""}
        </p>
      ) : null}
    </WorkspaceSection>
  );

  const tabs: WorkspaceTab[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-3">
          <AltaCardApplicationIntegration
            integration={integration}
            onPrefill={({ tier: t, limit: l, rate: r }) => {
              if (t) setTier(t);
              if (l) setLimit(String(l));
              if (r) setRate(String(r));
            }}
          />
          <WorkspaceSection title="Applicant">
            <WorkspaceFieldGrid columns={4}>
              <WorkspaceField label="Applicant">{app.applicantUsername}</WorkspaceField>
              <WorkspaceField label="Company">{app.companyName ?? "Personal"}</WorkspaceField>
              <WorkspaceField label="Card type">{app.cardType}</WorkspaceField>
              <WorkspaceField label="Status">
                <OpsStatusBadge status={ALTA_CARD_APPLICATION_STATUS_LABELS[app.status]} />
              </WorkspaceField>
              <WorkspaceField label="Requested tier">
                {ALTA_CARD_TIER_LABELS[app.requestedTier]}
              </WorkspaceField>
              <WorkspaceField label="Requested limit">
                {formatAltaCardCurrency(app.requestedLimit ?? 0)}
              </WorkspaceField>
              <WorkspaceField label="Applicant accounts">{review.applicantAccountCount}</WorkspaceField>
              <WorkspaceField label="Applicant loans">{review.applicantLoanCount}</WorkspaceField>
            </WorkspaceFieldGrid>
            {app.purpose ? <p className="mt-2 text-[13px] text-muted-foreground">{app.purpose}</p> : null}
          </WorkspaceSection>
        </div>
      ),
    },
    {
      id: "thread",
      label: "Deal Room",
      content: (
        <div className="min-h-[520px] overflow-hidden rounded-lg border border-border/60">
          <LoanApplicationThreadView
            className="h-[520px]"
            context={mapAltaCardThreadContextToLoan(review.threadContext)}
            messages={mapAltaCardThreadMessagesToLoan(review.messages)}
            variant="internal"
            product="alta-card"
            backTo="/internal/alta-card/applications/$applicationId"
            backParams={{ applicationId }}
            backLabel="← Application workspace"
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
          <WorkspaceAuditLink entityType="ALTA_CARD" entityId={app.id} />
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
            Card notes use the owner customer profile until ALTA_CARD note targets are supported.
          </p>
          <InternalNotePanel targetType="USER" targetId={app.applicantUserId} initialNotes={notes} />
        </div>
      ),
    },
  ];

  return (
    <WorkspacePage
      title={app.applicantUsername}
      status={ALTA_CARD_APPLICATION_STATUS_LABELS[app.status]}
      breadcrumbs={workspaceBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Deal Rooms", to: "/internal/queues/deal-rooms" },
        { label: app.applicantUsername },
      ])}
      relatedLinks={
        <Link
          to="/internal/users/$userId"
          params={{ userId: app.applicantUserId }}
          className="text-[11px] text-gold hover:underline"
        >
          Customer →
        </Link>
      }
      tabs={tabs}
      activeTabId={activeTab}
      sidebar={
        <WorkspaceSidebar
          quickActions={
            <>
              <Link
                to="/internal/alta-card/applications/$applicationId"
                params={{ applicationId }}
                search={{ tab: "thread" }}
                className="rounded border border-gold/30 px-2 py-1 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
              >
                Open deal room
              </Link>
              {open ? (
                <Link
                  to="/internal/alta-card/applications/$applicationId"
                  params={{ applicationId }}
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
                  href: `/internal/users/${app.applicantUserId}?tab=relationship`,
                }
              : integration?.scope === "company" && app.companyId
                ? {
                    score: integration.bundle.panel.relationshipScore,
                    tier: formatRelationshipTier(integration.bundle.panel.relationshipTier),
                    totalAssets: integration.bundle.panel.totalBusinessAssets,
                    href: `/internal/companies/${app.companyId}?tab=relationship`,
                  }
                : null
          }
        />
      }
    />
  );
}
