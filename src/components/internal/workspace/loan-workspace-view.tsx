"use client";

import { Link } from "@tanstack/react-router";
import { InternalActiveLoanCard } from "@/components/bank/internal-loan-ops";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { InternalActivityTimeline } from "@/components/internal/internal-activity-timeline";
import { InternalLoanPaymentForm } from "@/components/internal/internal-loan-payment-form";
import { LoanPaymentScheduleTable } from "@/components/bank/loan-payment-schedule-table";
import { ResolvedLendingRelationshipIntegrationBlock } from "@/components/internal/relationship-integration-blocks";
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
import type { WorkspaceTab } from "@/components/internal/console/workspace-layout";
import { florin } from "@/lib/bank/api";
import type { InternalActiveLoanRow } from "@/lib/bank/lending-types";
import type { TimelineEvent } from "@/lib/internal/ops-types";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";

export function LoanWorkspaceView({
  loan,
  notes,
  timeline,
  relationship,
  integration,
  activeTab,
}: {
  loan: InternalActiveLoanRow;
  notes: Array<{ id: string; body: string; authorUsername: string; createdAt: string }>;
  timeline: TimelineEvent[];
  relationship: { userId: string | null; companyId: string | null };
  integration: ResolvedRelationshipIntegration | null;
  activeTab: string;
}) {
  const relatedRecords: RelatedRecord[] = [
    { kind: "loan", id: loan.id, label: loan.productLabel, sublabel: loan.borrowerLabel },
    ...(loan.linkedBankAccountId
      ? [{ kind: "bank_account" as const, id: loan.linkedBankAccountId, label: loan.linkedAccountNumber ?? "Linked account" }]
      : []),
    ...(relationship.userId
      ? [{ kind: "user" as const, id: relationship.userId, label: loan.borrowerLabel }]
      : []),
    ...(relationship.companyId
      ? [{ kind: "company" as const, id: relationship.companyId, label: loan.companyName ?? "Company" }]
      : []),
  ];

  const tabs: WorkspaceTab[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-3">
          <WorkspaceSection title="Facility">
            <WorkspaceFieldGrid columns={4}>
              <WorkspaceField label="Borrower">{loan.borrowerLabel}</WorkspaceField>
              <WorkspaceField label="Company">{loan.companyName ?? "—"}</WorkspaceField>
              <WorkspaceField label="Product">{loan.productLabel}</WorkspaceField>
              <WorkspaceField label="Status">{loan.statusLabel}</WorkspaceField>
              <WorkspaceField label="Principal">
                <span className="type-finance tabular-nums">{florin(loan.principalAmount)}</span>
              </WorkspaceField>
              <WorkspaceField label="Outstanding">
                <span className="type-finance tabular-nums">{florin(loan.principalOutstanding)}</span>
              </WorkspaceField>
              <WorkspaceField label="Payoff today">
                <span className="type-finance tabular-nums">{florin(loan.currentPayoffAmount)}</span>
              </WorkspaceField>
              <WorkspaceField label="Interest rate">{loan.interestRateLabel}</WorkspaceField>
              {loan.nextInterestGuaranteeDate ? (
                <WorkspaceField label="Next guarantee">
                  <span className="font-mono text-[11px]">{loan.nextInterestGuaranteeDate.slice(0, 10)}</span>
                </WorkspaceField>
              ) : null}
            </WorkspaceFieldGrid>
          </WorkspaceSection>
          <InternalActiveLoanCard loan={loan} />
        </div>
      ),
    },
    {
      id: "payments",
      label: "Payments",
      content: (
        <div className="space-y-3">
          <InternalLoanPaymentForm
            loanId={loan.id}
            linkedBankAccountId={loan.linkedBankAccountId}
            linkedAccountNumber={loan.linkedAccountNumber}
            currentPayoffAmount={loan.currentPayoffAmount}
          />
          <WorkspaceSection title="Payoff">
            <span className="type-finance tabular-nums text-[14px]">{florin(loan.currentPayoffAmount)}</span>
            <span className="ml-2 text-[11px] text-muted-foreground">current payoff</span>
          </WorkspaceSection>
        </div>
      ),
    },
    {
      id: "schedule",
      label: "Schedule",
      content: (
        <LoanPaymentScheduleTable
          schedule={loan.paymentSchedule}
          termMonths={loan.termMonths}
          monthlyPrincipalPercent={loan.monthlyPrincipalPercent}
        />
      ),
    },
    {
      id: "deal-room",
      label: "Deal Room",
      content: (
        <WorkspaceSection title="Secure Deal Room">
          <p className="text-[12px] text-muted-foreground">
            Originating application thread — open from the{" "}
            <Link to="/internal/queues/lending-applications" className="text-gold hover:underline">
              lending applications queue
            </Link>{" "}
            or borrower customer workspace.
          </p>
        </WorkspaceSection>
      ),
    },
    {
      id: "relationship",
      label: "Relationship",
      content: integration && relationship.userId ? (
        <ResolvedLendingRelationshipIntegrationBlock integration={integration} />
      ) : (
        <p className="text-[12px] text-muted-foreground">No relationship summary available.</p>
      ),
    },
    { id: "activity", label: "Activity", content: <InternalActivityTimeline events={timeline} /> },
    {
      id: "notes",
      label: "Notes",
      content: <InternalNotePanel targetType="LOAN" targetId={loan.id} initialNotes={notes} />,
    },
  ];

  return (
    <WorkspacePage
      title={loan.productLabel}
      status={loan.statusLabel}
      breadcrumbs={workspaceBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Lending", to: "/internal/lending" },
        { label: loan.borrowerLabel },
      ])}
      relatedLinks={
        loan.linkedAccountNumber ? (
          <span className="font-mono text-[10px] text-muted-foreground">{loan.linkedAccountNumber}</span>
        ) : null
      }
      tabs={tabs}
      activeTabId={activeTab}
      sidebar={
        <WorkspaceSidebar
          relatedRecords={relatedRecords}
          notes={notes}
          relationship={
            integration?.scope === "personal" && relationship.userId
              ? {
                  score: integration.bundle.panel.relationshipScore,
                  tier: formatRelationshipTier(integration.bundle.panel.relationshipTier),
                  totalAssets: integration.bundle.panel.totalAltaAssets,
                  href: `/internal/users/${relationship.userId}?tab=relationship`,
                }
              : integration?.scope === "company" && relationship.companyId
                ? {
                    score: integration.bundle.panel.relationshipScore,
                    tier: formatRelationshipTier(integration.bundle.panel.relationshipTier),
                    totalAssets: integration.bundle.panel.totalBusinessAssets,
                    href: `/internal/companies/${relationship.companyId}?tab=relationship`,
                  }
                : relationship.companyId
                  ? {
                      href: `/internal/companies/${relationship.companyId}?tab=relationship`,
                    }
                  : null
          }
        />
      }
    />
  );
}
