"use client";

import { Link } from "@tanstack/react-router";
import { InternalAltaCardDetailIntegration } from "@/components/bank/alta-card/internal-alta-card-detail-integration";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { WorkspaceAuditLink } from "@/components/internal/workspace/workspace-audit-link";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { InternalActivityTimeline } from "@/components/internal/internal-activity-timeline";
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
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import {
  ALTA_CARD_TIER_LABELS,
  altaCardStatusLabel,
  formatAltaCardCurrency,
  formatAltaCardRate,
} from "@/lib/bank/alta-card-types";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";
import type { AuditLogRow } from "@/lib/internal/audit.types";
import type { TimelineEvent } from "@/lib/internal/ops-types";

type AltaCardWorkspaceProps = {
  ops: React.ComponentProps<typeof InternalAltaCardDetailIntegration>["ops"];
  statements: React.ComponentProps<typeof InternalAltaCardDetailIntegration>["statements"];
  fees: React.ComponentProps<typeof InternalAltaCardDetailIntegration>["fees"];
  autopay: React.ComponentProps<typeof InternalAltaCardDetailIntegration>["autopay"];
  integration: ResolvedRelationshipIntegration | null;
  ownerUserId: string | null;
  companyId: string | null;
  searchDefaults?: React.ComponentProps<typeof InternalAltaCardDetailIntegration>["searchDefaults"];
  auditLogs?: AuditLogRow[];
  notes?: Array<{ id: string; body: string; authorUsername: string; createdAt: string }>;
  timeline?: TimelineEvent[];
  activeTab: string;
};

export function AltaCardWorkspaceView(props: AltaCardWorkspaceProps) {
  const { ops, integration, ownerUserId, companyId, activeTab } = props;
  const card = ops.card;
  const holderLabel = card.ownerUsername ?? card.companyName ?? "Cardholder";

  const relatedRecords: RelatedRecord[] = [
    { kind: "alta_card", id: card.id, label: holderLabel, sublabel: `····${card.cardLastFour}` },
    ...(ownerUserId
      ? [{ kind: "user" as const, id: ownerUserId, label: holderLabel }]
      : []),
    ...(companyId && card.companyName
      ? [{ kind: "company" as const, id: companyId, label: card.companyName }]
      : []),
    ...(card.paymentSourceAccountId
      ? [{ kind: "bank_account" as const, id: card.paymentSourceAccountId, label: "Payment source" }]
      : []),
  ];

  const opsPanel = (
    <InternalAltaCardDetailIntegration
      ops={props.ops}
      statements={props.statements}
      fees={props.fees}
      autopay={props.autopay}
      integration={props.integration}
      ownerUserId={props.ownerUserId}
      searchDefaults={props.searchDefaults}
    />
  );

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-3">
          <WorkspaceSection title="Card">
            <WorkspaceFieldGrid columns={4}>
              <WorkspaceField label="Cardholder">{holderLabel}</WorkspaceField>
              <WorkspaceField label="Company">{card.companyName ?? "Personal"}</WorkspaceField>
              <WorkspaceField label="Tier">{ALTA_CARD_TIER_LABELS[card.tier]}</WorkspaceField>
              <WorkspaceField label="Status">
                <OpsStatusBadge status={altaCardStatusLabel(card.status)} />
              </WorkspaceField>
              <WorkspaceField label="Limit">
                <span className="type-finance tabular-nums">{formatAltaCardCurrency(card.creditLimit)}</span>
              </WorkspaceField>
              <WorkspaceField label="Available">
                <span className="type-finance tabular-nums">{formatAltaCardCurrency(card.availableCredit)}</span>
              </WorkspaceField>
              <WorkspaceField label="Balance">
                <span className="type-finance tabular-nums">{formatAltaCardCurrency(card.currentBalance)}</span>
              </WorkspaceField>
              <WorkspaceField label="Rate">{formatAltaCardRate(card.interestRate)}</WorkspaceField>
              <WorkspaceField label="Utilization">
                <span className="tabular-nums">{ops.utilization.toFixed(1)}%</span>
              </WorkspaceField>
            </WorkspaceFieldGrid>
          </WorkspaceSection>
          {opsPanel}
        </div>
      ),
    },
    { id: "transactions", label: "Transactions", content: opsPanel },
    { id: "statements", label: "Statements", content: opsPanel },
    { id: "payments", label: "Payments", content: opsPanel },
    { id: "autopay", label: "Autopay", content: opsPanel },
    ...(card.cardType === "business"
      ? [{ id: "employees", label: "Employee Cards", content: opsPanel }]
      : []),
    {
      id: "relationship",
      label: "Relationship",
      content: integration ? (
        <WorkspaceSection title="Relationship Intelligence">
          <p className="text-[12px] text-muted-foreground">
            See full RI in{" "}
            {ownerUserId ? (
              <Link to="/internal/users/$userId" params={{ userId: ownerUserId }} search={{ tab: "relationship" }} className="text-gold hover:underline">
                customer workspace
              </Link>
            ) : (
              "customer workspace"
            )}
            .
          </p>
        </WorkspaceSection>
      ) : (
        <p className="text-[12px] text-muted-foreground">No relationship data.</p>
      ),
    },
    ...(props.timeline
      ? [{ id: "activity", label: "Activity", content: <InternalActivityTimeline events={props.timeline} /> }]
      : []),
    ...(props.auditLogs
      ? [{
          id: "audit",
          label: "Audit",
          content: (
            <>
              <WorkspaceAuditLink entityType="ALTA_CARD" entityId={card.id} />
              <InternalAuditTable rows={props.auditLogs} />
            </>
          ),
        }]
      : []),
    ...(ownerUserId && props.notes
      ? [{
          id: "notes",
          label: "Notes",
          content: (
            <div className="space-y-3">
              <p className="text-[12px] text-muted-foreground">
                Cardholder customer notes (ALTA_CARD note target not yet in Prisma).
              </p>
              <InternalNotePanel targetType="USER" targetId={ownerUserId} initialNotes={props.notes} />
            </div>
          ),
        }]
      : []),
  ] satisfies Array<{ id: string; label: string; content: React.ReactNode }>;

  return (
    <WorkspacePage
      title={`····${card.cardLastFour}`}
      status={altaCardStatusLabel(card.status)}
      breadcrumbs={workspaceBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Alta Card", to: "/internal/alta-card" },
        { label: holderLabel },
      ])}
      relatedLinks={
        ownerUserId ? (
          <Link to="/internal/users/$userId" params={{ userId: ownerUserId }} className="text-[11px] text-gold hover:underline">
            Customer →
          </Link>
        ) : null
      }
      tabs={tabs}
      activeTabId={activeTab}
      sidebar={
        <WorkspaceSidebar
          relatedRecords={relatedRecords}
          auditRows={props.auditLogs}
          notes={props.notes}
          relationship={
            integration?.scope === "personal"
              ? {
                  score: integration.bundle.panel.relationshipScore,
                  tier: formatRelationshipTier(integration.bundle.panel.relationshipTier),
                  totalAssets: integration.bundle.panel.totalAltaAssets,
                  href: ownerUserId ? `/internal/users/${ownerUserId}?tab=relationship` : "#",
                }
              : integration?.scope === "company"
                ? {
                    score: integration.bundle.panel.relationshipScore,
                    tier: formatRelationshipTier(integration.bundle.panel.relationshipTier),
                    totalAssets: integration.bundle.panel.totalBusinessAssets,
                    href: companyId ? `/internal/companies/${companyId}?tab=relationship` : "#",
                  }
                : null
          }
        />
      }
    />
  );
}
