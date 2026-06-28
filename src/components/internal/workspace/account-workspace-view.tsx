"use client";

import { Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/internal/status-badge";
import { OpsAction } from "@/components/internal/ops-action";
import { InternalAccountAdjustmentForm } from "@/components/internal/internal-account-adjustment-form";
import { InternalAccountOpsPanel } from "@/components/internal/internal-account-ops-panel";
import { InternalActivityTimeline } from "@/components/internal/internal-activity-timeline";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { WorkspaceAuditLink } from "@/components/internal/workspace/workspace-audit-link";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import {
  WorkspacePage,
  workspaceBreadcrumbs,
  WorkspaceSidebar,
  WorkspaceFieldGrid,
  WorkspaceField,
  WorkspaceSection,
  type RelatedRecord,
} from "@/components/internal/workspace";
import type { WorkspaceTab } from "@/components/internal/console/workspace-layout";
import {
  approveBankAccountOpening,
  closeBankAccountRecord,
  freezeBankAccountRecord,
  unfreezeBankAccountRecord,
} from "@/lib/bank/bank.functions";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { InternalBankTransactionRow } from "@/lib/bank/backend-types";
import type { AuditLogRow } from "@/lib/internal/audit.types";
import type { TimelineEvent } from "@/lib/internal/ops-types";

type AccountWorkspaceData = {
  account: Awaited<ReturnType<typeof import("@/lib/bank/bank.functions").fetchInternalBankAccountDetail>>;
  auditLogs: AuditLogRow[];
  notes: Array<{ id: string; body: string; authorUsername: string; createdAt: string }>;
  ops: Awaited<ReturnType<typeof import("@/lib/internal/ops-platform.functions").fetchAccountOpsSummary>>;
  timeline: TimelineEvent[];
};

export function AccountWorkspaceView({ data, activeTab }: { data: AccountWorkspaceData; activeTab: string }) {
  const { account, auditLogs, notes, ops, timeline } = data;

  const headerActions = (
    <>
      {account.status === "Under Review" && (
        <OpsAction
          label="Approve"
          variant="primary"
          title="Approve account opening"
          description="Activates the account for banking activity."
          impact={`${account.accountNumber}`}
          onConfirm={async (reason) => {
            await approveBankAccountOpening({ data: { accountId: account.id, reviewNote: reason } });
          }}
        />
      )}
      {account.status !== "Frozen" && account.status !== "Closed" && (
        <OpsAction
          label="Freeze"
          variant="danger"
          title="Freeze account"
          description="Blocks debits and most activity."
          impact={florin(account.balance)}
          onConfirm={async (reason) => {
            await freezeBankAccountRecord({ data: { accountId: account.id, reviewNote: reason } });
          }}
        />
      )}
      {account.status === "Frozen" && (
        <OpsAction
          label="Unfreeze"
          variant="primary"
          title="Unfreeze account"
          description="Restores normal activity."
          onConfirm={async (reason) => {
            await unfreezeBankAccountRecord({ data: { accountId: account.id, reviewNote: reason } });
          }}
        />
      )}
      {account.status !== "Closed" && account.balance === 0 && (
        <OpsAction
          label="Close"
          variant="danger"
          title="Close account"
          description="Permanently closes the account."
          onConfirm={async (reason) => {
            await closeBankAccountRecord({ data: { accountId: account.id, reviewNote: reason } });
          }}
        />
      )}
    </>
  );

  const relatedRecords: RelatedRecord[] = [
    { kind: "bank_account", id: account.id, label: account.accountName, sublabel: account.accountNumber },
  ];

  const tabs: WorkspaceTab[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <WorkspaceSection title="Account">
          <WorkspaceFieldGrid columns={4}>
            <WorkspaceField label="Holder">{account.holder}</WorkspaceField>
            <WorkspaceField label="Account name">{account.accountName}</WorkspaceField>
            <WorkspaceField label="Number">
              <span className="font-mono text-[11px]">{account.accountNumber}</span>
            </WorkspaceField>
            <WorkspaceField label="Product">{account.product}</WorkspaceField>
            <WorkspaceField label="Balance">
              <span className="type-finance tabular-nums">{florin(account.balance)}</span>
            </WorkspaceField>
            <WorkspaceField label="Status">
              <StatusBadge status={account.status} />
            </WorkspaceField>
            <WorkspaceField label="Routing">
              <span className="font-mono text-[11px]">{account.routingNumber}</span>
            </WorkspaceField>
            {ops.activeHoldTotal > 0 ? (
              <WorkspaceField label="Active holds">
                <span className="type-finance tabular-nums">{florin(ops.activeHoldTotal)}</span>
              </WorkspaceField>
            ) : null}
          </WorkspaceFieldGrid>
        </WorkspaceSection>
      ),
    },
    {
      id: "transactions",
      label: "Transactions",
      content: (
        <div className="space-y-3">
          <WorkspaceSection title="Pending">
            <TxTable rows={account.pendingTransactions} empty="No pending transactions." />
          </WorkspaceSection>
          <WorkspaceSection title="Recent">
            <TxTable rows={account.recentTransactions} empty="No transactions yet." />
          </WorkspaceSection>
        </div>
      ),
    },
    {
      id: "statements",
      label: "Statements",
      content: (
        <WorkspaceSection title="Statements">
          {ops.statements.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No statements generated.</p>
          ) : (
            <AdminDataTable
              columns={[
                { key: "num", header: "Statement", cell: (r) => <span className="font-mono text-[11px]">{r.statementNumber}</span> },
                { key: "period", header: "Period end", cell: (r) => r.periodEnd.slice(0, 10) },
                { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              ]}
              rows={ops.statements}
              rowKey={(r) => r.id}
            />
          )}
          <Link to="/internal/bank/statements" className="mt-2 inline-block text-[11px] text-gold hover:underline">
            Statement ops →
          </Link>
        </WorkspaceSection>
      ),
    },
    {
      id: "holds",
      label: "Holds & Restrictions",
      content: (
        <div className="space-y-3">
          <InternalAccountOpsPanel
            accountId={account.id}
            accountNumber={account.accountNumber}
            status={account.status}
            restrictions={ops.restrictions}
            holds={ops.holds}
            activeHoldTotal={ops.activeHoldTotal}
          />
          <WorkspaceSection title="Manual adjustment">
            <InternalAccountAdjustmentForm accountId={account.id} />
          </WorkspaceSection>
        </div>
      ),
    },
    { id: "activity", label: "Activity", content: <InternalActivityTimeline events={timeline} /> },
    { id: "audit", label: "Audit", content: (
      <>
        <WorkspaceAuditLink entityType="BANK_ACCOUNT" entityId={account.id} />
        <InternalAuditTable rows={auditLogs} showAccount={false} />
      </>
    ) },
    {
      id: "notes",
      label: "Notes",
      content: <InternalNotePanel targetType="BANK_ACCOUNT" targetId={account.id} initialNotes={notes} />,
    },
  ];

  return (
    <WorkspacePage
      title={account.accountName}
      status={account.status}
      breadcrumbs={workspaceBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Accounts", to: "/internal/bank/accounts" },
        { label: account.accountNumber },
      ])}
      relatedLinks={
        <span className="font-mono text-[10px] text-muted-foreground">{account.holder}</span>
      }
      headerActions={headerActions}
      tabs={tabs}
      activeTabId={activeTab}
      sidebar={
        <WorkspaceSidebar
          auditRows={auditLogs}
          notes={notes}
          relatedRecords={relatedRecords}
        />
      }
    />
  );
}

function TxTable({ rows, empty }: { rows: InternalBankTransactionRow[]; empty: string }) {
  return (
    <AdminDataTable
      columns={[
        {
          key: "ref",
          header: "Reference",
          cell: (r) => (
            <Link to="/internal/bank/transactions/$transactionId" params={{ transactionId: r.id }} className="font-mono text-[11px] text-gold hover:underline">
              {r.referenceCode}
            </Link>
          ),
        },
        { key: "type", header: "Type", cell: (r) => r.type },
        { key: "amount", header: "Amount", cell: (r) => r.amount },
        { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
        { key: "date", header: "Date", cell: (r) => <span className="font-mono text-[11px]">{r.submitted}</span> },
      ]}
      rows={rows}
      rowKey={(r) => r.id}
      emptyState={empty}
    />
  );
}

export type { AccountWorkspaceData };
