"use client";

import { Link } from "@tanstack/react-router";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { TransactionWorkspaceActions } from "@/components/internal/transaction-workspace-actions";
import { OpsReviewFlagsBanner } from "@/components/internal/ops-review-flags-banner";
import { OpsReviewFlagsPanel } from "@/components/internal/ops-review-flags-panel";
import { WorkspaceAuditLink } from "@/components/internal/workspace/workspace-audit-link";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import {
  WorkspacePage,
  workspaceBreadcrumbs,
  WorkspaceSidebar,
  WorkspaceFieldGrid,
  WorkspaceField,
  WorkspaceSection,
  RelatedRecords,
  type RelatedRecord,
} from "@/components/internal/workspace";
import type { WorkspaceTab } from "@/components/internal/console/workspace-layout";
import { StatusBadge } from "@/components/internal/status-badge";
import { florin } from "@/lib/bank/api";
import type { OpsReviewFlagRow } from "@/lib/internal/ops-review-flag.types";

type TransactionDetail = Awaited<
  ReturnType<typeof import("@/lib/internal/ops-platform.functions").fetchTransactionDetail>
>;

export function TransactionWorkspaceView({
  tx,
  audit,
  notes,
  activeTab,
  reviewFlags = [],
}: {
  tx: TransactionDetail;
  audit: import("@/lib/internal/audit.types").AuditLogRow[];
  notes: Array<{ id: string; body: string; authorUsername: string; createdAt: string }>;
  activeTab: string;
  reviewFlags?: OpsReviewFlagRow[];
}) {
  const relatedRecords: RelatedRecord[] = [
    { kind: "bank_account", id: tx.accountId, label: tx.accountNumber, sublabel: tx.holder },
    ...(tx.relatedLoanId ? [{ kind: "loan" as const, id: tx.relatedLoanId, label: "Related loan" }] : []),
    ...(tx.relatedAltaPayRef
      ? [{ kind: "alta_pay" as const, id: tx.relatedAltaPayRef, label: "Alta Pay", sublabel: tx.relatedAltaPayRef }]
      : []),
    ...tx.linkedTransactions.map((l) => ({
      kind: "transaction" as const,
      id: l.id,
      label: l.referenceCode,
      sublabel: l.type,
    })),
  ];

  const tabs: WorkspaceTab[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <WorkspaceSection title="Transaction">
          <WorkspaceFieldGrid columns={4}>
            <WorkspaceField label="Amount">
              <span className="type-finance tabular-nums text-[14px]">{florin(tx.amount)}</span>
            </WorkspaceField>
            <WorkspaceField label="Type">{tx.type}</WorkspaceField>
            <WorkspaceField label="Status">
              <StatusBadge status={tx.status} />
            </WorkspaceField>
            <WorkspaceField label="Reference">
              <span className="font-mono text-[11px]">{tx.referenceCode}</span>
            </WorkspaceField>
            <WorkspaceField label="Account">
              <Link to="/internal/bank/accounts/$accountId" params={{ accountId: tx.accountId }} className="text-gold hover:underline">
                {tx.accountNumber}
              </Link>
            </WorkspaceField>
            <WorkspaceField label="Holder">{tx.holder}</WorkspaceField>
            <WorkspaceField label="Created">
              <span className="font-mono text-[11px]">{tx.createdAt.slice(0, 19).replace("T", " ")}</span>
            </WorkspaceField>
            {tx.reviewedAt ? (
              <WorkspaceField label="Posted">
                <span className="font-mono text-[11px]">{tx.reviewedAt.slice(0, 19).replace("T", " ")}</span>
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
          <p className="mt-3 text-[12px] text-muted-foreground">{tx.description}</p>
          {tx.memo ? <p className="mt-1 text-[12px]">Memo: {tx.memo}</p> : null}
          {tx.reviewNote ? <p className="mt-1 text-[12px]">Review note: {tx.reviewNote}</p> : null}
        </WorkspaceSection>
      ),
    },
    {
      id: "related",
      label: "Related Records",
      content: (
        <WorkspaceSection title="Related records">
          <RelatedRecords records={relatedRecords} />
        </WorkspaceSection>
      ),
    },
    {
      id: "flags",
      label: "Review flags",
      content: (
        <OpsReviewFlagsPanel
          targetType="BANK_TRANSACTION"
          targetId={tx.id}
          initialFlags={reviewFlags}
        />
      ),
    },
    {
      id: "audit",
      label: "Audit",
      content: (
        <>
          <WorkspaceAuditLink entityType="BANK_TRANSACTION" entityId={tx.id} />
          <InternalAuditTable rows={audit} />
        </>
      ),
    },
    {
      id: "notes",
      label: "Notes",
      content: <InternalNotePanel targetType="BANK_TRANSACTION" targetId={tx.id} initialNotes={notes} />,
    },
  ];

  return (
    <>
      <OpsReviewFlagsBanner flags={reviewFlags.filter((f) => f.status === "ACTIVE")} />
      <WorkspacePage
        title={tx.referenceCode}
        status={tx.status}
        headerActions={<TransactionWorkspaceActions tx={tx} />}
        breadcrumbs={workspaceBreadcrumbs([
          { label: "Dashboard", to: "/internal" },
          { label: "Transactions", to: "/internal/bank/transactions" },
          { label: tx.referenceCode },
        ])}
        tabs={tabs}
        activeTabId={activeTab}
        sidebar={<WorkspaceSidebar auditRows={audit} notes={notes} relatedRecords={relatedRecords} />}
      />
    </>
  );
}
