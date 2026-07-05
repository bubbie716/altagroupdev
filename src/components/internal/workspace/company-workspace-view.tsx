"use client";

import { Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/internal/status-badge";
import { CompanyVerificationActions } from "@/components/internal/company-verification-actions";
import { AdminCommercialProGrantPanel } from "@/components/internal/admin-commercial-pro-grant-panel";
import { AdminOnly } from "@/components/internal/admin-only";
import { InternalActivityTimeline } from "@/components/internal/internal-activity-timeline";
import { OpsReviewFlagsBanner } from "@/components/internal/ops-review-flags-banner";
import { OpsReviewFlagsPanel } from "@/components/internal/ops-review-flags-panel";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { WorkspaceAuditLink } from "@/components/internal/workspace/workspace-audit-link";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import {
  CompanyRelationshipDetailPanel,
  CompanyProductHoldingsPanel,
} from "@/components/internal/company-relationship-intelligence-panel";
import { CompanyRelationshipRecommendationsPanel } from "@/components/internal/company-relationship-recommendations-panel";
import { CompanyRelationshipTimelinePanel } from "@/components/internal/company-relationship-timeline-panel";
import {
  WorkspacePage,
  workspaceBreadcrumbs,
  WorkspaceSidebar,
  WorkspaceFieldGrid,
  WorkspaceField,
  WorkspaceSection,
  WorkspaceCompactTable,
  formatRelationshipTier,
  type RelatedRecord,
} from "@/components/internal/workspace";
import type { WorkspaceTab } from "@/components/internal/console/workspace-layout";
import { formatCompanyRole } from "@/lib/internal/format";
import { florin } from "@/lib/bank/api";
import { COMPANY_RELATIONSHIP_TIER_LABELS } from "@/lib/bank/company-relationship-intelligence-config";
import type { TimelineEvent } from "@/lib/internal/ops-types";
import type { AuditLogRow } from "@/lib/internal/audit.types";
import type { OpsReviewFlagRow } from "@/lib/internal/ops-review-flag.types";

type Company360 = Awaited<
  ReturnType<typeof import("@/lib/internal/ops-platform.functions").fetchCompany360>
>;

export function CompanyWorkspaceView({
  data,
  auditLogs,
  relationship,
  relationshipRecommendations = [],
  relationshipTimeline = [],
  reviewFlags = [],
  activeTab,
}: {
  data: Company360;
  auditLogs: AuditLogRow[];
  relationship: Awaited<
    ReturnType<typeof import("@/lib/internal/company-relationship-intelligence.functions").fetchAdminCompanyRelationshipDetail>
  > | null;
  relationshipRecommendations?: Awaited<
    ReturnType<typeof import("@/lib/internal/company-relationship-intelligence.functions").fetchCompanyRelationshipRecommendations>
  >;
  relationshipTimeline?: Awaited<
    ReturnType<typeof import("@/lib/internal/company-relationship-intelligence.functions").fetchCompanyRelationshipTimeline>
  >;
  reviewFlags?: OpsReviewFlagRow[];
  activeTab: string;
}) {
  const { company, notes, timeline, bankAccounts, loans, altaPayActivity, statements, commercialPlan } =
    data;
  const display = relationship?.calculated ?? relationship?.profile;
  const totalAssets = bankAccounts.reduce((s, a) => s + a.balance, 0);
  const creditExposure = loans.reduce((s, l) => s + l.outstandingBalance, 0);

  const relatedRecords: RelatedRecord[] = [
    ...company.members.map((m) => ({
      kind: "user" as const,
      id: m.userId,
      label: m.discordUsername,
      sublabel: formatCompanyRole(m.role),
    })),
    ...bankAccounts.map((a) => ({
      kind: "bank_account" as const,
      id: a.id,
      label: a.accountName,
      sublabel: a.accountNumber,
    })),
    ...loans.map((l) => ({
      kind: "loan" as const,
      id: l.id,
      label: l.id.slice(0, 10),
      sublabel: florin(l.outstandingBalance),
    })),
  ];

  const tabs: WorkspaceTab[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-3">
          <WorkspaceSection title="Entity">
            <WorkspaceFieldGrid>
              <WorkspaceField label="Legal name">{company.name}</WorkspaceField>
              <WorkspaceField label="Type">{company.type}</WorkspaceField>
              <WorkspaceField label="Sector">{company.sector ?? "—"}</WorkspaceField>
              <WorkspaceField label="Verification">
                <StatusBadge status={company.verificationStatus} />
              </WorkspaceField>
              <WorkspaceField label="Status">
                <StatusBadge status={company.status} />
              </WorkspaceField>
              <WorkspaceField label="Registered">
                <span className="font-mono text-[11px]">{company.createdAt.slice(0, 10)}</span>
              </WorkspaceField>
              <WorkspaceField label="Business assets">
                <span className="type-finance tabular-nums">{florin(totalAssets)}</span>
              </WorkspaceField>
              <WorkspaceField label="Credit exposure">
                <span className="type-finance tabular-nums">{florin(creditExposure)}</span>
              </WorkspaceField>
              <WorkspaceField label="Members">{company.members.length}</WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspaceSection>
          <CompanyVerificationActions
            companyId={company.id}
            verificationStatus={company.verificationStatus}
            companyName={company.name}
          />
          <AdminOnly>
            <AdminCommercialProGrantPanel
              companyId={company.id}
              companyName={company.name}
              commercialPlan={commercialPlan}
            />
          </AdminOnly>
        </div>
      ),
    },
    {
      id: "members",
      label: "Members",
      content: (
        <WorkspaceSection title="Members">
          <WorkspaceCompactTable
            headers={["User", "Role", "Since"]}
            rows={company.members.map((m) => [
              <Link key={m.userId} to="/internal/users/$userId" params={{ userId: m.userId }} className="font-mono text-[11px] hover:text-gold">
                {m.discordUsername}
              </Link>,
              formatCompanyRole(m.role),
              <span key={`d-${m.membershipId}`} className="font-mono text-[10px] text-muted-foreground">
                {m.joinedAt.slice(0, 10)}
              </span>,
            ])}
          />
        </WorkspaceSection>
      ),
    },
    {
      id: "accounts",
      label: "Accounts",
      content: (
        <WorkspaceSection title="Business accounts">
          <WorkspaceCompactTable
            headers={["Account", "Type", "Status", "Balance"]}
            rows={bankAccounts.map((a) => [
              <Link key={a.id} to="/internal/bank/accounts/$accountId" params={{ accountId: a.id }} className="hover:text-gold">
                <div>{a.accountName}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{a.accountNumber}</div>
              </Link>,
              a.accountTypeLabel,
              <StatusBadge status={a.status} />,
              <span className="type-finance tabular-nums">{florin(a.balance)}</span>,
            ])}
          />
        </WorkspaceSection>
      ),
    },
    {
      id: "alta-card",
      label: "Alta Card",
      content: (
        <p className="text-[12px] text-muted-foreground">
          Business Alta Card details — open from{" "}
          <Link to="/internal/alta-card" className="text-gold hover:underline">
            Alta Card ops
          </Link>{" "}
          or member customer workspaces.
        </p>
      ),
    },
    {
      id: "lending",
      label: "Lending",
      content: (
        <WorkspaceSection title="Business loans">
          <WorkspaceCompactTable
            headers={["Loan", "Status", "Principal", "Outstanding"]}
            rows={loans.map((l) => [
              <Link key={l.id} to="/internal/lending/loans/$loanId" params={{ loanId: l.id }} className="font-mono text-[11px] text-gold hover:underline">
                {l.id.slice(0, 10)}
              </Link>,
              <StatusBadge status={l.status} />,
              <span className="type-finance tabular-nums">{florin(l.principalAmount)}</span>,
              <span className="type-finance tabular-nums">{florin(l.outstandingBalance)}</span>,
            ])}
          />
        </WorkspaceSection>
      ),
    },
    {
      id: "relationship",
      label: "Relationship",
      content: relationship?.calculated ? (
        <div className="space-y-3">
          <CompanyRelationshipDetailPanel
            companyId={company.id}
            companyName={company.name}
            profile={relationship.profile}
            calculated={relationship.calculated}
            timelineSummary={relationship.timelineSummary}
          />
          <CompanyProductHoldingsPanel holdings={relationship.calculated.productHoldings} />
          <CompanyRelationshipRecommendationsPanel
            companyId={company.id}
            recommendations={relationshipRecommendations}
          />
          <CompanyRelationshipTimelinePanel companyId={company.id} timeline={relationshipTimeline} />
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground">Relationship profile unavailable.</p>
      ),
    },
    {
      id: "alta-pay",
      label: "Alta Pay",
      content: (
        <WorkspaceSection title="Merchant activity">
          {altaPayActivity.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No Alta Pay activity.</p>
          ) : (
            <WorkspaceCompactTable
              headers={["Date", "Reference", "Account", "Amount"]}
              rows={altaPayActivity.map((tx) => [
                <span key={tx.id} className="font-mono text-[10px]">{tx.createdAt.slice(0, 10)}</span>,
                <Link to="/internal/bank/transactions/$transactionId" params={{ transactionId: tx.id }} className="font-mono text-[11px] text-gold hover:underline">
                  {tx.referenceCode}
                </Link>,
                tx.accountNumber,
                <span className="type-finance tabular-nums">{florin(tx.amount)}</span>,
              ])}
            />
          )}
        </WorkspaceSection>
      ),
    },
    { id: "activity", label: "Timeline", content: <InternalActivityTimeline events={timeline} /> },
    {
      id: "flags",
      label: "Review flags",
      content: (
        <OpsReviewFlagsPanel targetType="COMPANY" targetId={company.id} initialFlags={reviewFlags} />
      ),
    },
    { id: "audit", label: "Audit", content: (
      <>
        <WorkspaceAuditLink entityType="COMPANY" entityId={company.id} />
        <InternalAuditTable rows={auditLogs} />
      </>
    ) },
    {
      id: "notes",
      label: "Notes",
      content: <InternalNotePanel targetType="COMPANY" targetId={company.id} initialNotes={notes} />,
    },
  ];

  return (
    <>
      <OpsReviewFlagsBanner flags={reviewFlags} />
      <WorkspacePage
      title={company.name}
      status={company.verificationStatus}
      breadcrumbs={workspaceBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Companies", to: "/internal/companies" },
        { label: company.name },
      ])}
      relatedLinks={
        company.ticker ? (
          <span className="font-mono text-[10px] text-muted-foreground">{company.ticker}</span>
        ) : null
      }
      tabs={tabs}
      activeTabId={activeTab}
      sidebar={
        <WorkspaceSidebar
          auditRows={auditLogs}
          notes={notes}
          relatedRecords={relatedRecords}
          relationship={
            display
              ? {
                  score: display.relationshipScore,
                  tier: COMPANY_RELATIONSHIP_TIER_LABELS[display.relationshipTier],
                  totalAssets: display.totalBusinessAssets,
                  href: `/internal/companies/${company.id}?tab=relationship`,
                }
              : null
          }
        />
      }
      />
    </>
  );
}
