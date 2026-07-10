"use client";

import { Link } from "@tanstack/react-router";
import {
  INTERNAL_ACCOUNT_WORKSPACE_SEARCH,
  INTERNAL_ALTA_CARD_WORKSPACE_SEARCH,
  INTERNAL_COMPANY_WORKSPACE_SEARCH,
  internalWorkspaceTabSearch,
} from "@/lib/internal/internal-route-search";
import { StatusBadge } from "@/components/internal/status-badge";
import { InternalUserTagPanel } from "@/components/internal/internal-user-tag-panel";
import { InternalUserAccountStatusPanel } from "@/components/internal/internal-user-account-status-panel";
import { RelationshipIntelligenceOperatorPanel } from "@/components/internal/relationship-intelligence-operator-panel";
import { InternalActivityTimeline } from "@/components/internal/internal-activity-timeline";
import { OpsReviewFlagsBanner } from "@/components/internal/ops-review-flags-banner";
import { OpsReviewFlagsPanel } from "@/components/internal/ops-review-flags-panel";
import { InternalAuditTable, AccountActivityLink } from "@/components/internal/internal-audit-table";
import { WorkspaceAuditLink } from "@/components/internal/workspace/workspace-audit-link";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
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
import { formatAccountStatus, formatUserTag } from "@/lib/auth/tags";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { InternalUserDetail } from "@/lib/internal/user-management.types";
import type { TimelineEvent } from "@/lib/internal/ops-types";
import type { AltaPrivateInternalSummary } from "@/lib/bank/alta-private-types";

type CustomerWorkspaceData = {
  user: InternalUserDetail;
  notes: Array<{ id: string; body: string; authorUsername: string; createdAt: string }>;
  timeline: TimelineEvent[];
  isPrivateClient: boolean;
  altaPayActivity: Array<{
    id: string;
    accountId: string;
    direction: string;
    referenceCode: string;
    amount: number;
    accountName: string;
    accountNumber: string;
    createdAt: string;
  }>;
  operatorPanel: {
    panel: Parameters<typeof RelationshipIntelligenceOperatorPanel>[0]["panel"];
    recommendations: Parameters<typeof RelationshipIntelligenceOperatorPanel>[0]["recommendations"];
    timelinePreview: Parameters<typeof RelationshipIntelligenceOperatorPanel>[0]["timelinePreview"];
    preApprovalReadiness: Parameters<typeof RelationshipIntelligenceOperatorPanel>[0]["preApprovalReadiness"];
    altaCardId: string | null;
    altaPrivateSummary?: AltaPrivateInternalSummary;
    canManageInvitations?: boolean;
  };
  reviewFlags?: OpsReviewFlagRow[];
};

export function CustomerWorkspaceView({
  data,
  activeTab,
  privateReview,
}: {
  data: CustomerWorkspaceData;
  activeTab: string;
  privateReview?: boolean;
}) {
  const { user, notes, timeline, isPrivateClient, altaPayActivity, operatorPanel, reviewFlags = [] } = data;
  const creditExposure = user.activeLoans.reduce((s, l) => s + l.currentPayoffAmount, 0);

  const relatedRecords: RelatedRecord[] = [
    ...user.bankAccounts.map((a) => ({
      kind: "bank_account" as const,
      id: a.id,
      label: a.accountName,
      sublabel: a.accountNumber,
    })),
    ...user.companyMemberships.map((m) => ({
      kind: "company" as const,
      id: m.companyId,
      label: m.companyName,
      sublabel: m.roleLabel,
    })),
    ...user.activeLoans.map((l) => ({
      kind: "loan" as const,
      id: l.id,
      label: l.productLabel,
      sublabel: florin(l.currentPayoffAmount),
    })),
    ...(operatorPanel.altaCardId
      ? [{ kind: "alta_card" as const, id: operatorPanel.altaCardId, label: "Alta Card", sublabel: user.discordUsername }]
      : []),
  ];

  const dealRooms = user.loanApplications.map((app) => ({
    label: `${app.productLabel} application`,
    to: `/internal/lending/applications/${app.id}/thread`,
    status: app.statusLabel,
  }));

  const tabs: WorkspaceTab[] = [
    { id: "overview", label: "Overview", content: overviewTab(user, creditExposure, isPrivateClient, privateReview) },
    { id: "accounts", label: "Accounts", content: accountsTab(user) },
    { id: "alta-card", label: "Alta Card", content: altaCardTab(operatorPanel.altaCardId, user) },
    { id: "lending", label: "Lending", content: lendingTab(user) },
    {
      id: "relationship",
      label: "Relationship",
      content: (
        <RelationshipIntelligenceOperatorPanel
          userId={user.id}
          panel={operatorPanel.panel}
          recommendations={operatorPanel.recommendations}
          timelinePreview={operatorPanel.timelinePreview}
          preApprovalReadiness={operatorPanel.preApprovalReadiness}
          altaCardId={operatorPanel.altaCardId}
          altaPrivateSummary={operatorPanel.altaPrivateSummary}
          canManageInvitations={operatorPanel.canManageInvitations}
        />
      ),
    },
    { id: "companies", label: "Companies", content: companiesTab(user) },
    { id: "activity", label: "Timeline", content: <InternalActivityTimeline events={timeline} /> },
    {
      id: "flags",
      label: "Review flags",
      content: (
        <OpsReviewFlagsPanel targetType="USER" targetId={user.id} initialFlags={reviewFlags} />
      ),
    },
    { id: "audit", label: "Audit", content: (
      <>
        <WorkspaceAuditLink entityType="USER" entityId={user.id} />
        <InternalAuditTable rows={user.recentAuditLogs} />
      </>
    ) },
    {
      id: "notes",
      label: "Notes",
      content: <InternalNotePanel targetType="USER" targetId={user.id} initialNotes={notes} />,
    },
  ];

  return (
    <>
      <OpsReviewFlagsBanner flags={reviewFlags} />
      <WorkspacePage
      title={user.discordUsername}
      status={formatAccountStatus(user.accountStatus)}
      breadcrumbs={workspaceBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Customers", to: "/internal/users" },
        { label: user.discordUsername },
      ])}
      relatedLinks={
        <>
          <span className="font-mono text-[10px] text-muted-foreground">Discord {user.discordId}</span>
          {user.minecraftUsername ? (
            <span className="font-mono text-[10px] text-muted-foreground">MC {user.minecraftUsername}</span>
          ) : null}
        </>
      }
      tabs={tabs}
      activeTabId={activeTab}
      sidebar={
        <WorkspaceSidebar
          auditRows={user.recentAuditLogs}
          notes={notes}
          relatedRecords={relatedRecords}
          dealRooms={dealRooms}
          relationship={
            operatorPanel.panel
              ? {
                  score: operatorPanel.panel.relationshipScore,
                  tier: formatRelationshipTier(operatorPanel.panel.relationshipTier),
                  totalAssets: operatorPanel.panel.totalAltaAssets,
                  href: `/internal/users/${user.id}?tab=relationship`,
                }
              : null
          }
        />
      }
      />
    </>
  );
}

function overviewTab(
  user: InternalUserDetail,
  creditExposure: number,
  isPrivateClient: boolean,
  privateReview?: boolean,
) {
  const activeProducts = [
    user.bankAccounts.length > 0 ? "Banking" : null,
    user.activeLoans.length > 0 ? "Lending" : null,
    user.loanApplications.some((a) => !a.statusLabel.toLowerCase().includes("denied")) ? "Lending app" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      {privateReview ? (
        <p className="rounded border border-gold/30 bg-gold/5 px-3 py-2 text-[12px]">
          Alta Private invitation review — send an invitation from the Relationship tab. Membership activates only after the customer accepts.
        </p>
      ) : null}
      <WorkspaceSection title="Identity">
        <WorkspaceFieldGrid>
          <WorkspaceField label="Discord">{user.discordUsername}</WorkspaceField>
          <WorkspaceField label="Discord ID">
            <span className="font-mono text-[11px]">{user.discordId}</span>
          </WorkspaceField>
          <WorkspaceField label="Email">{user.email ?? "—"}</WorkspaceField>
          <WorkspaceField label="Minecraft">
            <span className="font-mono text-[11px]">{user.minecraftUsername ?? "—"}</span>
          </WorkspaceField>
          <WorkspaceField label="Status">
            <StatusBadge status={formatAccountStatus(user.accountStatus)} />
          </WorkspaceField>
          <WorkspaceField label="Customer since">
            <span className="font-mono text-[11px]">{user.createdAt.slice(0, 10)}</span>
          </WorkspaceField>
          <WorkspaceField label="Total bank assets">
            <span className="type-finance tabular-nums">{florin(user.totalBankBalance)}</span>
          </WorkspaceField>
          <WorkspaceField label="Credit exposure">
            <span className="type-finance tabular-nums">{florin(creditExposure)}</span>
          </WorkspaceField>
          <WorkspaceField label="Active products">{activeProducts.join(" · ") || "—"}</WorkspaceField>
          {isPrivateClient ? (
            <WorkspaceField label="Alta Private">
              <span className="text-gold">Active membership</span>
            </WorkspaceField>
          ) : null}
        </WorkspaceFieldGrid>
      </WorkspaceSection>
      <div className="grid gap-3 lg:grid-cols-2">
        <WorkspaceSection title="Access tags">
          <InternalUserTagPanel user={user} />
        </WorkspaceSection>
        <WorkspaceSection title="Account status">
          <InternalUserAccountStatusPanel user={user} />
        </WorkspaceSection>
      </div>
      {user.recentTransactions[0] ? (
        <WorkspaceSection title="Latest activity">
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatActivityDateTime(user.recentTransactions[0].createdAt)} ·{" "}
            {user.recentTransactions[0].description} · {florin(user.recentTransactions[0].amount)}
          </span>
        </WorkspaceSection>
      ) : null}
    </div>
  );
}

function accountsTab(user: InternalUserDetail) {
  return (
    <WorkspaceSection title="Linked accounts">
      <WorkspaceCompactTable
        headers={["Account", "Type", "Status", "Balance"]}
        rows={user.bankAccounts.map((a) => [
          <Link key={a.id} to="/internal/bank/accounts/$accountId" params={{ accountId: a.id }} search={INTERNAL_ACCOUNT_WORKSPACE_SEARCH} className="hover:text-gold">
            <div>{a.accountName}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{a.accountNumber}</div>
          </Link>,
          a.accountTypeLabel,
          <StatusBadge key={`s-${a.id}`} status={a.statusLabel} />,
          <span className="type-finance tabular-nums">{florin(a.balance)}</span>,
        ])}
      />
    </WorkspaceSection>
  );
}

function altaCardTab(altaCardId: string | null, user: InternalUserDetail) {
  if (!altaCardId) {
    return <p className="text-[12px] text-muted-foreground">No Alta Card on file for this customer.</p>;
  }
  return (
    <WorkspaceSection title="Alta Card">
      <Link
        to="/internal/alta-card/$cardId"
        params={{ cardId: altaCardId }}
        search={INTERNAL_ALTA_CARD_WORKSPACE_SEARCH}
        className="font-mono text-[11px] text-gold hover:underline"
      >
        Open card workspace →
      </Link>
      <p className="mt-2 text-[11px] text-muted-foreground">{user.discordUsername}</p>
    </WorkspaceSection>
  );
}

function lendingTab(user: InternalUserDetail) {
  return (
    <div className="space-y-3">
      <WorkspaceSection title="Active loans">
        <WorkspaceCompactTable
          headers={["Loan", "Product", "Payoff", "Status"]}
          rows={user.activeLoans.map((l) => [
            <Link key={l.id} to="/internal/lending/loans/$loanId" params={{ loanId: l.id }} search={internalWorkspaceTabSearch("overview")} className="font-mono text-[11px] text-gold hover:underline">
              {l.id.slice(0, 10)}
            </Link>,
            l.productLabel,
            <span className="type-finance tabular-nums">{florin(l.currentPayoffAmount)}</span>,
            <StatusBadge key={`ls-${l.id}`} status={l.statusLabel} />,
          ])}
        />
      </WorkspaceSection>
      <WorkspaceSection title="Applications">
        <WorkspaceCompactTable
          headers={["Application", "Product", "Amount", "Status", "Deal room"]}
          rows={user.loanApplications.map((a) => [
            <span key={a.id} className="font-mono text-[11px]">{a.id.slice(0, 8)}</span>,
            a.productLabel,
            <span className="type-finance tabular-nums">{florin(a.requestedAmount)}</span>,
            <StatusBadge status={a.statusLabel} />,
            <Link to="/internal/lending/applications/$applicationId/thread" params={{ applicationId: a.id }} className="text-gold hover:underline">
              Thread
            </Link>,
          ])}
        />
      </WorkspaceSection>
    </div>
  );
}

function companiesTab(user: InternalUserDetail) {
  return (
    <WorkspaceSection title="Company memberships">
      <WorkspaceCompactTable
        headers={["Company", "Role"]}
        rows={user.companyMemberships.map((m) => [
          <Link key={m.companyId} to="/internal/companies/$companyId" params={{ companyId: m.companyId }} search={INTERNAL_COMPANY_WORKSPACE_SEARCH} className="hover:text-gold">
            {m.companyName}
          </Link>,
          m.roleLabel,
        ])}
      />
    </WorkspaceSection>
  );
}

export type { CustomerWorkspaceData };
