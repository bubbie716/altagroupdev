import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import {
  approveBankWithdrawal,
  denyBankWithdrawal,
  fetchInternalBankOps,
} from "@/lib/bank/bank.functions";
import type { InternalBankTransactionRow } from "@/lib/bank/backend-types";

export const Route = createFileRoute("/internal/bank/withdrawals")({
  loader: async () => {
    const ops = await fetchInternalBankOps();
    return ops.pendingWithdrawals;
  },
  head: () => ({ meta: [{ title: "Withdrawal Review — Alta Internal" }] }),
  component: InternalWithdrawals,
});

function InternalWithdrawals() {
  const pendingWithdrawals = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Withdrawal Review"
      description="Verify balances and approve or deny pending withdrawal requests."
    >
      <Link to="/internal/bank" className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline">
        ← Bank ops
      </Link>
      <Section title={`Pending withdrawals (${pendingWithdrawals.length})`}>
        <AdminDataTable columns={withdrawalColumns()} rows={pendingWithdrawals} rowKey={(r) => r.id} />
      </Section>
    </InternalPageShell>
  );
}

function withdrawalColumns() {
  return [
    { key: "ref", header: "Ref", cell: (r: InternalBankTransactionRow) => <span className="font-mono text-[11px]">{r.referenceCode}</span> },
    { key: "account", header: "Account", cell: (r: InternalBankTransactionRow) => <span className="font-mono text-[11px]">{r.account}</span> },
    { key: "holder", header: "Holder", cell: (r: InternalBankTransactionRow) => r.holder },
    { key: "amount", header: "Amount", cell: (r: InternalBankTransactionRow) => <span className="type-finance">{r.amount}</span> },
    { key: "memo", header: "Memo", cell: (r: InternalBankTransactionRow) => r.memo ?? "—" },
    { key: "submitted", header: "Submitted", cell: (r: InternalBankTransactionRow) => <span className="font-mono text-[11px]">{r.submitted}</span> },
    { key: "status", header: "Status", cell: (r: InternalBankTransactionRow) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      cell: (r: InternalBankTransactionRow) => (
        <div className="flex flex-wrap gap-1">
          <BankReviewButton label="Approve" variant="primary" onAction={async () => { await approveBankWithdrawal({ data: { transactionId: r.id } }); }} />
          <BankReviewButton label="Deny" variant="danger" onAction={async () => { await denyBankWithdrawal({ data: { transactionId: r.id } }); }} />
        </div>
      ),
    },
  ];
}
