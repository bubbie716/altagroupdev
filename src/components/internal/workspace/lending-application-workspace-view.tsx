"use client";

import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { OpsAction } from "@/components/internal/ops-action";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { ResolvedLendingRelationshipIntegrationBlock } from "@/components/internal/relationship-integration-blocks";
import { Textarea } from "@/components/ui/textarea";
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
import { florin } from "@/lib/bank/api";
import { applicationListStatusLabel } from "@/lib/bank/loan-application-thread-types";
import type {
  LoanApplicationThreadContext,
  LoanApplicationThreadMessageRow,
} from "@/lib/bank/loan-application-thread-types";
import {
  approveLoanApplicationRecord,
  denyLoanApplicationRecord,
  markLoanApplicationUnderReviewRecord,
} from "@/lib/bank/lending.functions";
import type { InternalLoanApplicationRow, LoanProductTypeCode } from "@/lib/bank/lending-types";
import { LOAN_PRODUCT_DEFAULT_MONTHLY_RATES } from "@/lib/bank/lending-types";
import type { AuditLogRow } from "@/lib/internal/audit.types";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";
import { formatActivityDateTime } from "@/lib/format-datetime";

function isActionable(status: InternalLoanApplicationRow["status"]) {
  return status === "pending" || status === "under_review";
}

function defaultMonthlyRate(productType: LoanProductTypeCode): string {
  const rate = LOAN_PRODUCT_DEFAULT_MONTHLY_RATES[productType];
  return rate != null ? String(rate) : "";
}

function LendingApplicationDecisionPanel({ application }: { application: InternalLoanApplicationRow }) {
  const [reviewNote, setReviewNote] = useState(application.reviewNote ?? "");
  const [interestRate, setInterestRate] = useState(() => defaultMonthlyRate(application.productType));
  const [principalAmount, setPrincipalAmount] = useState(String(application.requestedAmount));
  const [termMonths, setTermMonths] = useState(String(application.termMonths));

  if (!isActionable(application.status)) {
    return (
      <WorkspaceSection title="Decision">
        <OpsStatusBadge status={applicationListStatusLabel(application, "internal")} />
        {application.reviewNote ? (
          <p className="mt-2 text-[13px] text-muted-foreground">{application.reviewNote}</p>
        ) : null}
      </WorkspaceSection>
    );
  }

  return (
    <WorkspaceSection title="Credit decision">
      <p className="mb-3 text-[12px] text-muted-foreground">
        Applicant ↔ Alta Credit Desk. All decisions require a reason and are recorded in audit.
      </p>
      <div className="space-y-3">
        <div>
          <label className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            Review note
          </label>
          <Textarea
            className="mt-1 min-h-[56px] text-[12px]"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
          />
        </div>
        <WorkspaceFieldGrid columns={3}>
          <WorkspaceField label="Monthly rate %">
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded border border-border bg-surface-1 px-2 py-1 text-[12px]"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
            />
          </WorkspaceField>
          <WorkspaceField label="Principal ƒ">
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded border border-border bg-surface-1 px-2 py-1 text-[12px]"
              value={principalAmount}
              onChange={(e) => setPrincipalAmount(e.target.value)}
            />
          </WorkspaceField>
          <WorkspaceField label="Term (mo)">
            <input
              type="number"
              min="1"
              step="1"
              className="mt-1 w-full rounded border border-border bg-surface-1 px-2 py-1 text-[12px]"
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
            />
          </WorkspaceField>
        </WorkspaceFieldGrid>
        <div className="flex flex-wrap gap-1">
          {application.status === "pending" ? (
            <OpsAction
              label="Begin review"
              title="Begin application review"
              description="Marks the application under review and notifies the applicant in the deal room."
              onConfirm={async (reason) => {
                await markLoanApplicationUnderReviewRecord({
                  data: {
                    applicationId: application.id,
                    reviewNote: reviewNote.trim() || reason,
                  },
                });
              }}
            />
          ) : null}
          <OpsAction
            label="Accept"
            variant="primary"
            title="Approve loan application"
            description="Creates the loan facility with the terms below."
            impact={`${florin(Number(principalAmount) || 0)} · ${termMonths} mo · ${interestRate}% monthly`}
            onConfirm={async (reason) => {
              await approveLoanApplicationRecord({
                data: {
                  applicationId: application.id,
                  interestRate: Number(interestRate),
                  principalAmount: Number(principalAmount),
                  termMonths: Number(termMonths),
                  reviewNote: reviewNote.trim() || reason,
                },
              });
            }}
          />
          <OpsAction
            label="Deny"
            variant="danger"
            title="Deny loan application"
            description="Closes the application and notifies the applicant."
            onConfirm={async (reason) => {
              await denyLoanApplicationRecord({
                data: {
                  applicationId: application.id,
                  reviewNote: reviewNote.trim() || reason,
                },
              });
            }}
          />
        </div>
      </div>
    </WorkspaceSection>
  );
}

export function LendingApplicationWorkspaceView({
  application,
  threadContext,
  threadMessages,
  integration,
  auditLogs,
  notes,
  activeTab,
  applicationId,
}: {
  application: InternalLoanApplicationRow;
  threadContext: LoanApplicationThreadContext;
  threadMessages: LoanApplicationThreadMessageRow[];
  integration: ResolvedRelationshipIntegration | null;
  auditLogs: AuditLogRow[];
  notes: Array<{ id: string; body: string; authorUsername: string; createdAt: string }>;
  activeTab: string;
  applicationId: string;
}) {
  const relatedRecords: RelatedRecord[] = [
    {
      kind: "lending_application",
      id: application.id,
      label: application.productLabel,
      sublabel: application.applicantLabel,
    },
    ...(application.applicantUserId
      ? [{ kind: "user" as const, id: application.applicantUserId, label: application.applicantLabel }]
      : []),
    ...(application.companyId && application.companyName
      ? [{ kind: "company" as const, id: application.companyId, label: application.companyName }]
      : []),
    ...(application.linkedBankAccountId
      ? [{
          kind: "bank_account" as const,
          id: application.linkedBankAccountId,
          label: application.linkedAccountNumber ?? "Linked account",
        }]
      : []),
  ];

  const tabs: WorkspaceTab[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-3">
          <WorkspaceSection title="Application">
            <WorkspaceFieldGrid columns={4}>
              <WorkspaceField label="Applicant">{application.applicantLabel}</WorkspaceField>
              <WorkspaceField label="Company">{application.companyName ?? "Personal"}</WorkspaceField>
              <WorkspaceField label="Product">{application.productLabel}</WorkspaceField>
              <WorkspaceField label="Status">
                <OpsStatusBadge status={applicationListStatusLabel(application, "internal")} />
              </WorkspaceField>
              <WorkspaceField label="Requested">
                <span className="type-finance tabular-nums">{florin(application.requestedAmount)}</span>
              </WorkspaceField>
              <WorkspaceField label="Term">{application.termMonths} mo</WorkspaceField>
              <WorkspaceField label="Submitted">
                {formatActivityDateTime(application.submittedAt)}
              </WorkspaceField>
              <WorkspaceField label="Deal room">
                <OpsStatusBadge status={threadContext.statusLabel} />
              </WorkspaceField>
            </WorkspaceFieldGrid>
            {application.purpose ? (
              <p className="mt-3 text-[13px] text-muted-foreground">{application.purpose}</p>
            ) : null}
          </WorkspaceSection>
          {integration ? (
            <ResolvedLendingRelationshipIntegrationBlock integration={integration} />
          ) : null}
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
            context={threadContext}
            messages={threadMessages}
            variant="internal"
            product="loan"
            backTo="/internal/lending/applications/$applicationId"
            backParams={{ applicationId }}
            backLabel="← Application workspace"
          />
        </div>
      ),
    },
    {
      id: "decision",
      label: "Decision",
      content: <LendingApplicationDecisionPanel application={application} />,
    },
    {
      id: "audit",
      label: "Audit",
      content: (
        <>
          <WorkspaceAuditLink entityType="LOAN_APPLICATION" entityId={application.id} />
          <InternalAuditTable rows={auditLogs} />
        </>
      ),
    },
    {
      id: "notes",
      label: "Notes",
      content: (
        <InternalNotePanel targetType="USER" targetId={application.applicantUserId} initialNotes={notes} />
      ),
    },
  ];

  return (
    <WorkspacePage
      title={application.productLabel}
      status={applicationListStatusLabel(application, "internal")}
      breadcrumbs={workspaceBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Deal Rooms", to: "/internal/queues/deal-rooms" },
        { label: application.applicantLabel },
      ])}
      relatedLinks={
        <Link
          to="/internal/users/$userId"
          params={{ userId: application.applicantUserId }}
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
                to="/internal/lending/applications/$applicationId"
                params={{ applicationId }}
                search={{ tab: "thread" }}
                className="rounded border border-gold/30 px-2 py-1 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
              >
                Open deal room
              </Link>
              {isActionable(application.status) ? (
                <Link
                  to="/internal/lending/applications/$applicationId"
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
            integration?.panel
              ? {
                  score: integration.panel.relationshipScore,
                  tier: formatRelationshipTier(integration.panel.relationshipTier),
                  totalAssets: integration.panel.totalAltaAssets,
                  href: `/internal/users/${application.applicantUserId}?tab=relationship`,
                }
              : null
          }
        />
      }
    />
  );
}
