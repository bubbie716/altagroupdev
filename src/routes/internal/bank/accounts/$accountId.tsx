import { createFileRoute, Link } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { BankProofStatus } from "@/components/bank/bank-proof-link";
import { InternalAccountAdjustmentForm } from "@/components/internal/internal-account-adjustment-form";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { InternalAccountOpsPanel } from "@/components/internal/internal-account-ops-panel";
import { InternalActivityTimeline } from "@/components/internal/internal-activity-timeline";
import {
  approveBankAccountOpening,
  closeBankAccountRecord,
  fetchInternalBankAccountDetail,
  freezeBankAccountRecord,
  unfreezeBankAccountRecord,
} from "@/lib/bank/bank.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";
import { fetchAccountOpsSummary, fetchActivityTimeline } from "@/lib/internal/ops-platform.functions";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { InternalBankTransactionRow } from "@/lib/bank/backend-types";

export const Route = createFileRoute("/internal/bank/accounts/$accountId")({
  loader: async ({ params }) => {
    const [account, auditLogs, notes, ops, timeline] = await Promise.all([
      fetchInternalBankAccountDetail({ data: params.accountId }),
      fetchAuditLogsForEntity({ data: { entityType: "BANK_ACCOUNT", entityId: params.accountId } }),
      fetchInternalNotes({ data: { targetType: "BANK_ACCOUNT", targetId: params.accountId } }),
      fetchAccountOpsSummary({ data: params.accountId }),
      fetchActivityTimeline({ data: { entityType: "BANK_ACCOUNT", entityId: params.accountId } }),
    ]);
    return { account, auditLogs, notes, ops, timeline };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.account.accountNumber ?? "Account"} — Alta Internal` }],
  }),
  component: InternalBankAccountDetail,
});

function InternalBankAccountDetail() {
  const { account, auditLogs, notes, ops, timeline } = Route.useLoaderData();

  return (
    <InternalPageShell
      title={account.accountName}
      description={`${account.accountNumber} · ${account.holder}`}
    >
      <Link
        to="/internal/bank/accounts"
        className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline"
      >
        ← All accounts
      </Link>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Balance" value={florin(account.balance)} />
        <Metric label="Status" value={account.status} />
        <Metric label="Product" value={account.product} />
        <Metric label="Routing" value={account.routingNumber} mono />
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {account.status === "Pending Review" && (
          <BankReviewButton
            label="Approve account"
            variant="primary"
            onAction={async () => {
              await approveBankAccountOpening({ data: { accountId: account.id } });
            }}
          />
        )}
        {account.status !== "Frozen" && account.status !== "Closed" && (
          <BankReviewButton
            label="Freeze"
            onAction={async () => {
              await freezeBankAccountRecord({ data: { accountId: account.id, reviewNote: "Frozen via account detail" } });
            }}
          />
        )}
        {account.status === "Frozen" && (
          <BankReviewButton
            label="Unfreeze"
            variant="primary"
            onAction={async () => {
              await unfreezeBankAccountRecord({ data: { accountId: account.id } });
            }}
          />
        )}
        {account.status !== "Closed" && account.balance === 0 && (
          <BankReviewButton
            label="Close account"
            onAction={async () => {
              await closeBankAccountRecord({ data: { accountId: account.id, reviewNote: "Closed via account detail" } });
            }}
          />
        )}
      </div>

      <Section title="Money operations">
        <InternalAccountOpsPanel
          accountId={account.id}
          accountNumber={account.accountNumber}
          status={account.status}
          restrictions={ops.restrictions}
          holds={ops.holds}
          activeHoldTotal={ops.activeHoldTotal}
        />
      </Section>

      <Section title="Admin adjustment" className="mt-10">
        <InternalAccountAdjustmentForm accountId={account.id} />
      </Section>

      <Section title="Scheduled transfers" className="mt-10">
        {ops.scheduled.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No scheduled transfers.</p>
        ) : (
          <AdminDataTable
            columns={[
              { key: "name", header: "Label", cell: (r) => r.label },
              { key: "amount", header: "Amount", cell: (r) => florin(r.amount) },
              {
                key: "next",
                header: "Next run",
                cell: (r) => (r.nextRunDate ? formatActivityDateTime(r.nextRunDate) : "—"),
              },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            ]}
            rows={ops.scheduled}
            rowKey={(r) => r.id}
          />
        )}
      </Section>

      <Section title="Statements" className="mt-10">
        {ops.statements.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No statements generated.</p>
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
      </Section>

      <Section title="Pending transactions" className="mt-10">
        <TxTable rows={account.pendingTransactions} empty="No pending transactions." />
      </Section>

      <Section title="Recent transactions" className="mt-10">
        <TxTable rows={account.recentTransactions} empty="No transactions yet." />
      </Section>

      <Section title="Activity timeline" className="mt-10">
        <InternalActivityTimeline events={timeline} />
      </Section>

      <Section title="Internal notes" className="mt-10">
        <InternalNotePanel targetType="BANK_ACCOUNT" targetId={account.id} initialNotes={notes} />
      </Section>

      <Section title="Audit history" className="mt-10">
        <InternalAuditTable rows={auditLogs} showAccount={false} />
      </Section>
    </InternalPageShell>
  );
}

function Metric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Card className="!p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${mono ? "font-mono text-[13px]" : "tabular"}`}>{value}</div>
    </Card>
  );
}

function TxTable({ rows, empty }: { rows: InternalBankTransactionRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-muted-foreground">{empty}</p>;
  }
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
        { key: "desc", header: "Description", cell: (r) => r.description },
        { key: "date", header: "Date", cell: (r) => <span className="font-mono text-[11px]">{r.submitted}</span> },
      ]}
      rows={rows}
      rowKey={(r) => r.id}
    />
  );
}
