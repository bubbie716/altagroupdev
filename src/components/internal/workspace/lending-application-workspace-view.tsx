"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { OpsAction } from "@/components/internal/ops-action";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import {
  LendingRelationshipCompactSummary,
  ResolvedLendingRelationshipIntegrationBlock,
} from "@/components/internal/relationship-integration-blocks";
import { Textarea } from "@/components/ui/textarea";
import { RelatedRecords, type RelatedRecord } from "@/components/internal/workspace/related-records";
import { workspaceBreadcrumbs } from "@/components/internal/workspace/workspace-page";
import { RecordSinglePage } from "@/components/internal/workspace/record-workspace-page";
import {
  RecordEmptyCopy,
  RecordMoreSection,
  RecordSummaryCard,
} from "@/components/internal/workspace/record-workspace-layout";
import {
  RecordActionGroup,
  RecordActionsSheet,
} from "@/components/internal/workspace/record-actions-sheet";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import { WorkspaceAuditLink } from "@/components/internal/workspace/workspace-audit-link";
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
import type { InternalNoteRow } from "@/lib/internal/internal-note.types";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";
import { OPS_COPY } from "@/lib/internal/console/ops-copy";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  recordSectionId,
  toCaseRecordSearchParams,
  type CaseRecordSearch,
} from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";
import {
  INTERNAL_ACCOUNT_WORKSPACE_SEARCH,
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  INTERNAL_USER_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";

function isActionable(status: InternalLoanApplicationRow["status"]) {
  return status === "pending" || status === "under_review";
}

function defaultMonthlyRate(productType: LoanProductTypeCode): string {
  const rate = LOAN_PRODUCT_DEFAULT_MONTHLY_RATES[productType];
  return rate != null ? String(rate) : "";
}

function buildLendingApplicationLifecycle(application: InternalLoanApplicationRow): Array<{
  id: string;
  title: string;
  detail?: string;
  at: string;
}> {
  const events: Array<{ id: string; title: string; detail?: string; at: string }> = [
    { id: "submitted", title: "Submitted", at: application.submittedAt },
  ];

  if (application.status === "under_review" || application.reviewedAt) {
    events.push({
      id: "under_review",
      title: "Under review",
      at: application.reviewedAt ?? application.submittedAt,
    });
  } else if (application.status === "pending") {
    events.push({
      id: "pending",
      title: "Awaiting review",
      at: application.submittedAt,
    });
  }

  if (application.reviewedAt) {
    const decidedTitle =
      application.status === "approved"
        ? "Accepted"
        : application.status === "denied"
          ? "Denied"
          : application.status === "cancelled"
            ? "Cancelled"
            : "Decided";
    events.push({
      id: "decided",
      title: decidedTitle,
      detail: application.reviewNote ?? undefined,
      at: application.reviewedAt,
    });
  }

  return events;
}

export function LendingApplicationDecisionSummary({
  application,
}: {
  application: InternalLoanApplicationRow;
}) {
  const statusLabel = applicationListStatusLabel(application, "internal");
  const actionable = isActionable(application.status);

  return (
    <RecordSummaryCard
      title={actionable ? "Needs attention" : "Decision summary"}
      id={recordSectionId("decision")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <OpsStatusBadge status={statusLabel} />
        {application.reviewedAt ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatActivityDateTime(application.reviewedAt)}
          </span>
        ) : null}
      </div>
      {actionable ? (
        <p className="mt-2 text-[13px] text-amber-800 dark:text-amber-200">
          Needs a credit decision. Review evidence and record the decision in Actions.
        </p>
      ) : application.reviewNote ? (
        <p className="mt-2 text-[13px] text-muted-foreground">{application.reviewNote}</p>
      ) : (
        <RecordEmptyCopy>No review note recorded.</RecordEmptyCopy>
      )}
    </RecordSummaryCard>
  );
}

export function LendingApplicationDecisionActions({
  application,
  uiLab,
  unavailableLabel,
}: {
  application: InternalLoanApplicationRow;
  uiLab: boolean;
  unavailableLabel: (action: string) => string;
}) {
  const [reviewNote, setReviewNote] = useState(application.reviewNote ?? "");
  const [interestRate, setInterestRate] = useState(() => defaultMonthlyRate(application.productType));
  const [principalAmount, setPrincipalAmount] = useState(String(application.requestedAmount));
  const [termMonths, setTermMonths] = useState(String(application.termMonths));

  if (!isActionable(application.status)) {
    return (
      <p className="text-[12px] text-muted-foreground">
        This application is closed. No further credit actions are available.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">
        Applicant ↔ Alta Credit Desk. All decisions require a reason and are recorded in audit.
      </p>
      <div>
        <label className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Review note
        </label>
        <Textarea
          className="mt-1 min-h-[56px] text-[12px]"
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          disabled={uiLab}
        />
      </div>
      <WorkspaceFieldGrid columns={3}>
        <WorkspaceField label="Monthly rate %">
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded border border-border bg-surface-1 px-2 py-1 text-[12px] disabled:opacity-60"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            disabled={uiLab}
          />
        </WorkspaceField>
        <WorkspaceField label="Principal ƒ">
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded border border-border bg-surface-1 px-2 py-1 text-[12px] disabled:opacity-60"
            value={principalAmount}
            onChange={(e) => setPrincipalAmount(e.target.value)}
            disabled={uiLab}
          />
        </WorkspaceField>
        <WorkspaceField label="Term (mo)">
          <input
            type="number"
            min="1"
            step="1"
            className="mt-1 w-full rounded border border-border bg-surface-1 px-2 py-1 text-[12px] disabled:opacity-60"
            value={termMonths}
            onChange={(e) => setTermMonths(e.target.value)}
            disabled={uiLab}
          />
        </WorkspaceField>
      </WorkspaceFieldGrid>
      <div className="flex flex-wrap gap-1">
        {application.status === "pending" ? (
          <OpsAction
            label={uiLab ? unavailableLabel("Begin review") : "Begin review"}
            title="Begin application review"
            description={OPS_COPY.lendingBeginReviewDescription}
            disabled={uiLab}
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
          label={uiLab ? unavailableLabel("Accept") : "Accept"}
          variant="primary"
          title="Accept loan application"
          description="Creates the loan facility with the terms below."
          impact={`${florin(Number(principalAmount) || 0)} · ${termMonths} mo · ${interestRate}% monthly`}
          disabled={uiLab}
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
          label={uiLab ? unavailableLabel("Deny") : "Deny"}
          variant="danger"
          title="Deny loan application"
          description="Closes the application and notifies the applicant."
          disabled={uiLab}
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
  );
}

/** @deprecated use LendingApplicationDecisionSummary on page and LendingApplicationDecisionActions in the sheet */
export function LendingApplicationDecisionPanel({
  application,
}: {
  application: InternalLoanApplicationRow;
}) {
  const { uiLab, unavailableLabel } = useUiLabMutationGate();
  return (
    <>
      <LendingApplicationDecisionSummary application={application} />
      <LendingApplicationDecisionActions
        application={application}
        uiLab={uiLab}
        unavailableLabel={unavailableLabel}
      />
    </>
  );
}

export function LendingApplicationWorkspaceView({
  application,
  threadContext,
  threadMessages,
  integration,
  auditLogs,
  notes,
  search,
  applicationId,
}: {
  application: InternalLoanApplicationRow;
  threadContext: LoanApplicationThreadContext;
  threadMessages: LoanApplicationThreadMessageRow[];
  integration: ResolvedRelationshipIntegration | null;
  auditLogs: AuditLogRow[];
  notes: InternalNoteRow[];
  search: CaseRecordSearch;
  applicationId: string;
}) {
  const navigate = useNavigate();
  const { uiLab, unavailableLabel } = useUiLabMutationGate();
  const statusLabel = applicationListStatusLabel(application, "internal");
  const actionable = isActionable(application.status);
  const lifecycle = buildLendingApplicationLifecycle(application);
  const returnCtx = parseReturnPath(search.from);

  const relatedRecords: RelatedRecord[] = [
    ...(application.applicantUserId
      ? [{ kind: "user" as const, id: application.applicantUserId, label: application.applicantLabel }]
      : []),
    ...(application.companyId && application.companyName
      ? [{ kind: "company" as const, id: application.companyId, label: application.companyName }]
      : []),
    ...(application.linkedBankAccountId
      ? [
          {
            kind: "bank_account" as const,
            id: application.linkedBankAccountId,
            label: application.linkedAccountNumber ?? "Linked account",
          },
        ]
      : []),
  ];

  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
          { label: "Inbox", to: "/internal/inbox", search: returnCtx.search },
          { label: application.productLabel },
        ])
      : workspaceBreadcrumbs([
          { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
          { label: "Lending", to: "/internal/lending", search: withInternalSiteSearch({}, search.site) },
          { label: application.productLabel },
        ]);

  function jumpToSection(section: string) {
    void navigate({
      to: ".",
      search: () =>
        toCaseRecordSearchParams({
          section,
          from: search.from,
          site: search.site,
        }),
    });
  }

  const actions = (
    <RecordActionsSheet
      title="Application actions"
      description={`${application.productLabel} · ${application.applicantLabel}`}
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
      <RecordActionGroup title="Credit decision">
        <LendingApplicationDecisionActions
          application={application}
          uiLab={uiLab}
          unavailableLabel={unavailableLabel}
        />
      </RecordActionGroup>
      <RecordActionGroup title="Jump to">
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            className="rounded border border-border px-2.5 py-1.5 text-left text-[12px] hover:border-border-strong"
            onClick={() => jumpToSection("evidence")}
          >
            Evidence
          </button>
          <button
            type="button"
            className="rounded border border-border px-2.5 py-1.5 text-left text-[12px] hover:border-border-strong"
            onClick={() => jumpToSection("decision")}
          >
            Decision summary
          </button>
          <button
            type="button"
            className="rounded border border-border px-2.5 py-1.5 text-left text-[12px] hover:border-border-strong"
            onClick={() => jumpToSection("notes")}
          >
            Notes
          </button>
        </div>
      </RecordActionGroup>
      <RecordActionGroup title="Related">
        <div className="flex flex-col gap-1.5">
          <Link
            to="/internal/users/$userId"
            params={{ userId: application.applicantUserId }}
            search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
            className="text-[12px] text-gold hover:underline"
          >
            Open applicant customer
          </Link>
          {application.companyId ? (
            <Link
              to="/internal/companies/$companyId"
              params={{ companyId: application.companyId }}
              search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open company
            </Link>
          ) : null}
          {application.linkedBankAccountId ? (
            <Link
              to="/internal/bank/accounts/$accountId"
              params={{ accountId: application.linkedBankAccountId }}
              search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open linked account
            </Link>
          ) : null}
        </div>
      </RecordActionGroup>
    </RecordActionsSheet>
  );

  return (
    <RecordSinglePage
      title={application.productLabel}
      breadcrumbs={breadcrumbs}
      recordType="Lending application"
      primaryId={
        <>
          {florin(application.requestedAmount)}
          {application.termMonths ? ` · ${application.termMonths} mo` : ""}
        </>
      }
      status={statusLabel}
      meta={
        <>
          <span>{application.applicantLabel}</span>
          <span className="font-mono">{formatActivityDateTime(application.submittedAt)}</span>
        </>
      }
      warning={
        actionable ? (
          <span className="text-[12px] text-amber-700 dark:text-amber-300">Needs a credit decision</span>
        ) : null
      }
      headerActions={actions}
      search={search}
    >
      <div className="space-y-3">
        <LendingApplicationDecisionSummary application={application} />

        <RecordSummaryCard title="Requested terms" id={recordSectionId("summary")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Requested">
              <span className="type-finance tabular-nums text-[14px]">
                {florin(application.requestedAmount)}
              </span>
            </WorkspaceField>
            <WorkspaceField label="Term">{application.termMonths} mo</WorkspaceField>
            <WorkspaceField label="Status">
              <OpsStatusBadge status={statusLabel} />
            </WorkspaceField>
            <WorkspaceField label="Product">{application.productLabel}</WorkspaceField>
            <WorkspaceField label="Company">{application.companyName ?? "Personal"}</WorkspaceField>
            <WorkspaceField label="Submitted">
              <span className="font-mono text-[11px]">
                {formatActivityDateTime(application.submittedAt)}
              </span>
            </WorkspaceField>
            {application.purpose ? (
              <WorkspaceField label="Purpose" className="sm:col-span-2 lg:col-span-3">
                {application.purpose}
              </WorkspaceField>
            ) : null}
            {application.repaymentPlan ? (
              <WorkspaceField label="Repayment plan" className="sm:col-span-2 lg:col-span-3">
                {application.repaymentPlan}
              </WorkspaceField>
            ) : null}
            {application.collateralDescription ? (
              <WorkspaceField label="Collateral" className="sm:col-span-2 lg:col-span-3">
                {application.collateralDescription}
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="Applicant & company" id={recordSectionId("related")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Applicant">
              <Link
                to="/internal/users/$userId"
                params={{ userId: application.applicantUserId }}
                search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                className="text-gold hover:underline"
              >
                {application.applicantLabel}
              </Link>
            </WorkspaceField>
            {application.companyId && application.companyName ? (
              <WorkspaceField label="Company">
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId: application.companyId }}
                  search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                  className="text-gold hover:underline"
                >
                  {application.companyName}
                </Link>
              </WorkspaceField>
            ) : (
              <WorkspaceField label="Company">Personal</WorkspaceField>
            )}
            {application.linkedBankAccountId ? (
              <WorkspaceField label="Linked account">
                <Link
                  to="/internal/bank/accounts/$accountId"
                  params={{ accountId: application.linkedBankAccountId }}
                  search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, search.site)}
                  className="font-mono text-[11px] text-gold hover:underline"
                >
                  {application.linkedAccountNumber ?? application.linkedBankAccountId}
                </Link>
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
          {integration ? (
            <div className="mt-3">
              <LendingRelationshipCompactSummary integration={integration} />
            </div>
          ) : null}
        </RecordSummaryCard>

        <RecordSummaryCard title="Evidence" id={recordSectionId("evidence")}>
          <p className="mb-2 text-[12px] text-muted-foreground">
            Deal room · {threadContext.statusLabel}
          </p>
          <div className="min-h-[420px] overflow-hidden rounded-lg border border-border/60">
            <LoanApplicationThreadView
              className="h-[420px]"
              context={threadContext}
              messages={threadMessages}
              variant="internal"
              product="loan"
              embedded
            />
          </div>
        </RecordSummaryCard>

        <RecordSummaryCard title="Lifecycle" id={recordSectionId("lifecycle")}>
          <ol className="space-y-2">
            {lifecycle.map((e) => (
              <li key={e.id} className="rounded border border-border/50 px-3 py-2">
                <div className="text-[13px] font-medium">{e.title}</div>
                {e.detail ? (
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{e.detail}</p>
                ) : null}
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {formatActivityDateTime(e.at)}
                </div>
              </li>
            ))}
          </ol>
        </RecordSummaryCard>

        <RecordSummaryCard title="Related records" id={recordSectionId("related-records")}>
          <RelatedRecords records={relatedRecords} site={search.site} />
        </RecordSummaryCard>

        <div className="space-y-2">
          <RecordMoreSection
            id={recordSectionId("underwriting")}
            title="Underwriting details"
            defaultOpen={search.section === "underwriting"}
          >
            {integration ? (
              <ResolvedLendingRelationshipIntegrationBlock integration={integration} />
            ) : (
              <RecordEmptyCopy>No relationship intelligence available for this application.</RecordEmptyCopy>
            )}
          </RecordMoreSection>
          <RecordMoreSection
            id={recordSectionId("notes")}
            title="Internal notes"
            defaultOpen={search.section === "notes"}
          >
            <InternalNotePanel
              targetType="USER"
              targetId={application.applicantUserId}
              initialNotes={notes}
            />
          </RecordMoreSection>
          <RecordMoreSection
            id={recordSectionId("audit")}
            title="Audit history"
            defaultOpen={search.section === "audit"}
          >
            <WorkspaceAuditLink entityType="LOAN_APPLICATION" entityId={application.id} site={search.site} />
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
                <span className="break-all font-mono text-[11px]">{application.id}</span>
              </WorkspaceField>
              <WorkspaceField label="Product type">
                <span className="font-mono text-[11px]">{application.productType}</span>
              </WorkspaceField>
              <WorkspaceField label="Raw status">
                <span className="font-mono text-[11px]">{application.status}</span>
              </WorkspaceField>
              <WorkspaceField label="Applicant user ID">
                <span className="break-all font-mono text-[11px]">{application.applicantUserId}</span>
              </WorkspaceField>
              {application.threadId ? (
                <WorkspaceField label="Thread ID">
                  <span className="break-all font-mono text-[11px]">{application.threadId}</span>
                </WorkspaceField>
              ) : null}
              {application.dealRoomId ? (
                <WorkspaceField label="Deal room ID">
                  <span className="break-all font-mono text-[11px]">{application.dealRoomId}</span>
                </WorkspaceField>
              ) : null}
              {application.companyId ? (
                <WorkspaceField label="Company ID">
                  <span className="break-all font-mono text-[11px]">{application.companyId}</span>
                </WorkspaceField>
              ) : null}
              {application.linkedBankAccountId ? (
                <WorkspaceField label="Linked account ID">
                  <span className="break-all font-mono text-[11px]">{application.linkedBankAccountId}</span>
                </WorkspaceField>
              ) : null}
            </WorkspaceFieldGrid>
          </RecordMoreSection>
        </div>
      </div>
    </RecordSinglePage>
  );
}
