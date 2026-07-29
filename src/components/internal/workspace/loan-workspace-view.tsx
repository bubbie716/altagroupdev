"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import {
  INTERNAL_ACCOUNT_WORKSPACE_SEARCH,
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  INTERNAL_USER_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { InternalActiveLoanCard } from "@/components/bank/internal-loan-ops";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { InternalLoanPaymentForm } from "@/components/internal/internal-loan-payment-form";
import { canAcceptLoanPayment, loanPaymentUnavailableCopy } from "@/lib/internal/lending-desk";
import { LoanPaymentScheduleTable } from "@/components/bank/loan-payment-schedule-table";
import { workspaceBreadcrumbs } from "@/components/internal/workspace/workspace-page";
import { RecordWorkspacePage } from "@/components/internal/workspace/record-workspace-page";
import {
  RecordAttentionBanner,
  RecordEmptyCopy,
  RecordMoreSection,
  RecordSummaryCard,
  type RecordWorkspaceTab,
} from "@/components/internal/workspace/record-workspace-layout";
import { RecordActivityTimeline } from "@/components/internal/workspace/record-activity-timeline";
import {
  RecordActionGroup,
  RecordActionsSheet,
} from "@/components/internal/workspace/record-actions-sheet";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { InternalActiveLoanRow } from "@/lib/bank/lending-types";
import type { TimelineEvent } from "@/lib/internal/ops-types";
import type { InternalNoteRow } from "@/lib/internal/internal-note.types";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";
import {
  LOAN_ACTIVITY_FILTERS,
  LOAN_ACTIVITY_FILTER_LABELS,
} from "@/lib/internal/record-activity-filters";
import {
  recordSectionId,
  toRecordWorkspaceSearchParams,
  type RecordActivityFilter,
  type RecordWorkspaceSearch,
} from "@/lib/internal/record-workspace-search";
import { parseReturnPath } from "@/lib/internal/record-return-context";

export function LoanWorkspaceView({
  loan,
  notes,
  timeline,
  relationship,
  integration,
  search,
}: {
  loan: InternalActiveLoanRow;
  notes: InternalNoteRow[];
  timeline: TimelineEvent[];
  relationship: { userId: string | null; companyId: string | null };
  integration: ResolvedRelationshipIntegration | null;
  search: RecordWorkspaceSearch;
}) {
  const navigate = useNavigate();
  const attention = buildLoanAttention(loan);
  const recentEvents = [...timeline]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const returnCtx = parseReturnPath(search.from);
  const breadcrumbs =
    returnCtx?.pathname === "/internal/inbox"
      ? workspaceBreadcrumbs([
          { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
          { label: "Inbox", to: "/internal/inbox", search: returnCtx.search },
          { label: loan.borrowerLabel },
        ])
      : returnCtx?.pathname.startsWith("/internal/users")
        ? workspaceBreadcrumbs([
            { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
            { label: "Customers", to: "/internal/users", search: withInternalSiteSearch({}, search.site) },
            {
              label: loan.borrowerLabel,
              to: returnCtx.pathname,
              search: returnCtx.search,
            },
            { label: loan.productLabel },
          ])
        : returnCtx?.pathname.startsWith("/internal/companies")
          ? workspaceBreadcrumbs([
              { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
              { label: "Companies", to: "/internal/companies", search: withInternalSiteSearch({}, search.site) },
              {
                label: loan.companyName ?? "Company",
                to: returnCtx.pathname,
                search: returnCtx.search,
              },
              { label: loan.productLabel },
            ])
          : workspaceBreadcrumbs([
              { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
              { label: "Lending", to: "/internal/lending", search: withInternalSiteSearch({}, search.site) },
              { label: loan.borrowerLabel },
            ]);

  function setActivityFilter(filter: RecordActivityFilter) {
    void navigate({
      to: ".",
      search: () =>
        toRecordWorkspaceSearchParams({
          tab: "activity",
          filter,
          from: search.from,
          site: search.site,
        }),
    });
  }

  const overview: RecordWorkspaceTab = {
    id: "overview",
    label: "Overview",
    content: (
      <div className="space-y-3">
        {attention.length > 0 ? <RecordAttentionBanner items={attention} /> : null}

        <RecordSummaryCard title="Loan summary" id={recordSectionId("summary")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Borrower">
              {relationship.userId ? (
                <Link
                  to="/internal/users/$userId"
                  params={{ userId: relationship.userId }}
                  search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                  className="break-words hover:text-gold"
                >
                  {loan.borrowerLabel}
                </Link>
              ) : (
                loan.borrowerLabel
              )}
            </WorkspaceField>
            <WorkspaceField label="Company">
              {relationship.companyId ? (
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId: relationship.companyId }}
                  search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                  className="break-words hover:text-gold"
                >
                  {loan.companyName ?? relationship.companyId}
                </Link>
              ) : (
                (loan.companyName ?? "—")
              )}
            </WorkspaceField>
            <WorkspaceField label="Product">{loan.productLabel}</WorkspaceField>
            <WorkspaceField label="Principal">
              <span className="type-finance tabular-nums">{florin(loan.principalAmount)}</span>
            </WorkspaceField>
            <WorkspaceField label="Outstanding">
              <span className="type-finance tabular-nums">{florin(loan.principalOutstanding)}</span>
            </WorkspaceField>
            <WorkspaceField label="Payoff today">
              <span className="type-finance tabular-nums text-[14px]">
                {florin(loan.currentPayoffAmount)}
              </span>
            </WorkspaceField>
            <WorkspaceField label="Interest rate">{loan.interestRateLabel}</WorkspaceField>
            {loan.nextInterestGuaranteeDate ? (
              <WorkspaceField label="Next guarantee">
                <span className="font-mono text-[11px]">
                  {loan.nextInterestGuaranteeDate.slice(0, 10)}
                </span>
              </WorkspaceField>
            ) : null}
            {loan.nextInterestAccrualAt ? (
              <WorkspaceField label="Next accrual">
                <span className="font-mono text-[11px]">
                  {formatActivityDateTime(loan.nextInterestAccrualAt)}
                </span>
              </WorkspaceField>
            ) : null}
            {loan.lastPaymentAt ? (
              <WorkspaceField label="Last payment">
                <span className="font-mono text-[11px]">
                  {formatActivityDateTime(loan.lastPaymentAt)}
                </span>
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="Payments" id={recordSectionId("payments")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Payoff">
              <span className="type-finance tabular-nums">{florin(loan.currentPayoffAmount)}</span>
            </WorkspaceField>
            <WorkspaceField label="Guaranteed interest">
              <span className="type-finance tabular-nums">{florin(loan.guaranteedInterestOwed)}</span>
            </WorkspaceField>
            <WorkspaceField label="Payment status">{loan.paymentStatusLabel}</WorkspaceField>
          </WorkspaceFieldGrid>
          <div className="mt-3">
            {canAcceptLoanPayment(loan) ? (
              <InternalLoanPaymentForm
                loanId={loan.id}
                loanLabel={loan.productLabel}
                borrowerLabel={loan.borrowerLabel}
                linkedBankAccountId={loan.linkedBankAccountId}
                linkedAccountNumber={loan.linkedAccountNumber}
                currentPayoffAmount={loan.currentPayoffAmount}
                paymentSchedule={loan.paymentSchedule}
              />
            ) : (
              <p className="text-[13px] text-muted-foreground">
                {loanPaymentUnavailableCopy(loan)}
              </p>
            )}
          </div>
        </RecordSummaryCard>

        <RecordSummaryCard
          title="Recent activity"
          id={recordSectionId("recent")}
          actions={
            <button
              type="button"
              className="text-[12px] text-gold hover:underline"
              onClick={() =>
                void navigate({
                  to: ".",
                  search: () =>
                    toRecordWorkspaceSearchParams({
                      tab: "activity",
                      from: search.from,
                      site: search.site,
                    }),
                })
              }
            >
              Full activity →
            </button>
          }
        >
          {recentEvents.length === 0 ? (
            <RecordEmptyCopy>No recent activity.</RecordEmptyCopy>
          ) : (
            <ul className="space-y-1.5">
              {recentEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 text-[12px]"
                >
                  <span className="min-w-0 break-words">{event.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatActivityDateTime(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </RecordSummaryCard>

        <RecordSummaryCard title="Related records" id={recordSectionId("related")}>
          <ul className="space-y-1.5 text-[12px]">
            {relationship.userId ? (
              <li>
                <Link
                  to="/internal/users/$userId"
                  params={{ userId: relationship.userId }}
                  search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
                  className="text-gold hover:underline"
                >
                  Customer · {loan.borrowerLabel}
                </Link>
              </li>
            ) : null}
            {relationship.companyId ? (
              <li>
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId: relationship.companyId }}
                  search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
                  className="text-gold hover:underline"
                >
                  Company · {loan.companyName ?? relationship.companyId}
                </Link>
              </li>
            ) : null}
            {loan.linkedBankAccountId ? (
              <li>
                <Link
                  to="/internal/bank/accounts/$accountId"
                  params={{ accountId: loan.linkedBankAccountId }}
                  search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, search.site)}
                  className="text-gold hover:underline"
                >
                  Linked account · {loan.linkedAccountNumber ?? loan.linkedBankAccountId}
                </Link>
              </li>
            ) : null}
            {!relationship.userId && !relationship.companyId && !loan.linkedBankAccountId ? (
              <RecordEmptyCopy>No related records.</RecordEmptyCopy>
            ) : null}
          </ul>
        </RecordSummaryCard>
      </div>
    ),
  };

  const activity: RecordWorkspaceTab = {
    id: "activity",
    label: "Activity",
    content: (
      <RecordActivityTimeline
        events={timeline}
        filter={search.filter}
        onFilterChange={setActivityFilter}
        filters={LOAN_ACTIVITY_FILTERS}
        filterLabels={LOAN_ACTIVITY_FILTER_LABELS}
        scope="loan"
      />
    ),
  };

  const more: RecordWorkspaceTab = {
    id: "more",
    label: "More",
    content: (
      <div className="space-y-2">
        <RecordMoreSection
          id={recordSectionId("schedule")}
          title="Payment schedule"
          defaultOpen={search.section === "schedule"}
        >
          <LoanPaymentScheduleTable
            schedule={loan.paymentSchedule}
            termMonths={loan.termMonths}
            monthlyPrincipalPercent={loan.monthlyPrincipalPercent}
          />
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("servicing")}
          title="Servicing"
          defaultOpen={search.section === "servicing"}
        >
          <InternalActiveLoanCard loan={loan} />
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("evidence")}
          title="Evidence"
          defaultOpen={search.section === "evidence"}
        >
          <RecordEmptyCopy>
            Underwriting evidence lives on the originating lending application. Open it from the
            borrower workspace or{" "}
            <Link
              to="/internal/inbox"
              search={withInternalSiteSearch({ category: "lending", type: "lending_application" }, search.site)}
              className="text-gold hover:underline"
            >
              lending applications
            </Link>
            .
          </RecordEmptyCopy>
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("notes")}
          title="Internal notes"
          defaultOpen={search.section === "notes"}
        >
          <InternalNotePanel targetType="LOAN" targetId={loan.id} initialNotes={notes} />
        </RecordMoreSection>
        <RecordMoreSection
          id={recordSectionId("technical")}
          title="Technical details"
          defaultOpen={search.section === "technical"}
        >
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Loan ID">
              <span className="break-all font-mono text-[11px]">{loan.id}</span>
            </WorkspaceField>
            <WorkspaceField label="Status">
              <span className="font-mono text-[11px]">{loan.status}</span>
            </WorkspaceField>
            {loan.linkedBankAccountId ? (
              <WorkspaceField label="Linked account ID">
                <span className="break-all font-mono text-[11px]">{loan.linkedBankAccountId}</span>
              </WorkspaceField>
            ) : null}
            {relationship.userId ? (
              <WorkspaceField label="Borrower user ID">
                <span className="break-all font-mono text-[11px]">{relationship.userId}</span>
              </WorkspaceField>
            ) : null}
            {relationship.companyId ? (
              <WorkspaceField label="Company ID">
                <span className="break-all font-mono text-[11px]">{relationship.companyId}</span>
              </WorkspaceField>
            ) : null}
            {integration ? (
              <WorkspaceField label="Relationship scope">
                <span className="font-mono text-[11px]">{integration.scope}</span>
              </WorkspaceField>
            ) : null}
            {loan.termMonths != null ? (
              <WorkspaceField label="Term months">
                <span className="tabular-nums">{loan.termMonths}</span>
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </RecordMoreSection>
      </div>
    ),
  };

  const actions = (
    <RecordActionsSheet
      title="Loan actions"
      description={`Actions for ${loan.productLabel}`}
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
          {canAcceptLoanPayment(loan) ? (
            <ActionNav
              label="Record payment"
              onClick={() =>
                void navigate({
                  to: ".",
                  search: () =>
                    toRecordWorkspaceSearchParams({
                      tab: "overview",
                      section: "payments",
                      from: search.from,
                      site: search.site,
                    }),
                })
              }
            />
          ) : null}
          <ActionNav
            label="Payment schedule"
            onClick={() =>
              void navigate({
                to: ".",
                search: () =>
                  toRecordWorkspaceSearchParams({
                    tab: "more",
                    section: "schedule",
                    from: search.from,
                    site: search.site,
                  }),
              })
            }
          />
          <ActionNav
            label="Servicing controls"
            onClick={() =>
              void navigate({
                to: ".",
                search: () =>
                  toRecordWorkspaceSearchParams({
                    tab: "more",
                    section: "servicing",
                    from: search.from,
                    site: search.site,
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
                  toRecordWorkspaceSearchParams({
                    tab: "more",
                    section: "notes",
                    from: search.from,
                    site: search.site,
                  }),
              })
            }
          />
        </div>
      </RecordActionGroup>
      <RecordActionGroup title="Related">
        <div className="flex flex-col gap-1.5">
          {relationship.userId ? (
            <Link
              to="/internal/users/$userId"
              params={{ userId: relationship.userId }}
              search={withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open borrower
            </Link>
          ) : null}
          {relationship.companyId ? (
            <Link
              to="/internal/companies/$companyId"
              params={{ companyId: relationship.companyId }}
              search={withInternalSiteSearch(INTERNAL_COMPANY_WORKSPACE_SEARCH, search.site)}
              className="text-[12px] text-gold hover:underline"
            >
              Open company
            </Link>
          ) : null}
          {loan.linkedBankAccountId ? (
            <Link
              to="/internal/bank/accounts/$accountId"
              params={{ accountId: loan.linkedBankAccountId }}
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
    <RecordWorkspacePage
      title={loan.productLabel}
      breadcrumbs={breadcrumbs}
      recordType="Active loan"
      primaryId={
        <span className="type-finance tabular-nums">{florin(loan.currentPayoffAmount)}</span>
      }
      status={loan.statusLabel}
      meta={
        <>
          <span>{loan.borrowerLabel}</span>
          {loan.linkedAccountNumber ? (
            <span className="font-mono">{loan.linkedAccountNumber}</span>
          ) : null}
        </>
      }
      warning={
        attention.length > 0 ? (
          <span className="text-[12px] text-amber-700 dark:text-amber-300">
            {attention.map((a) => a.label).slice(0, 2).join(" · ")}
          </span>
        ) : null
      }
      headerActions={actions}
      tabs={[overview, activity, more]}
      search={search}
    />
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

function buildLoanAttention(loan: InternalActiveLoanRow) {
  const items: Array<{ id: string; label: string; detail?: string }> = [];
  // Paid-off is terminal — do not surface schedule-derived overdue/past-due attention.
  if (loan.status === "paid_off") return items;
  if (loan.status === "frozen" || /frozen/i.test(loan.statusLabel)) {
    items.push({ id: "frozen", label: "Loan frozen", detail: loan.statusLabel });
  }
  if (/delinquent/i.test(loan.riskStatusLabel) || /delinquent/i.test(loan.paymentStatusLabel)) {
    items.push({
      id: "delinquent",
      label: "Delinquent",
      detail: loan.paymentStatusLabel !== "Not available" ? loan.paymentStatusLabel : undefined,
    });
  }
  if (/past\s*due/i.test(loan.paymentStatusLabel) || /past\s*due/i.test(loan.riskStatusLabel)) {
    items.push({
      id: "past-due",
      label: "Past due",
      detail: loan.paymentStatusLabel !== "Not available" ? loan.paymentStatusLabel : undefined,
    });
  }
  if (loan.status === "defaulted" || /default/i.test(loan.statusLabel)) {
    items.push({ id: "defaulted", label: "Defaulted", detail: loan.statusLabel });
  }
  return items;
}
