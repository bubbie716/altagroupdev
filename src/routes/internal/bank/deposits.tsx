import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { BankProofStatus } from "@/components/bank/bank-proof-link";
import {
  approveBankDeposit,
  denyBankDeposit,
  fetchInternalBankOps,
} from "@/lib/bank/bank.functions";
import type { InternalBankTransactionRow } from "@/lib/bank/backend-types";

export const Route = createFileRoute("/internal/bank/deposits")({
  loader: async () => {
    const ops = await fetchInternalBankOps();
    return ops.pendingDeposits;
  },
  head: () => ({ meta: [{ title: "Deposit Review — Alta Internal" }] }),
  component: InternalDeposits,
});

function InternalDeposits() {
  const pendingDeposits = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Deposit Review"
      description="Approve or deny pending deposit requests with proof verification."
    >
      <Link to="/internal/bank" className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline">
        ← Bank ops
      </Link>
      <Section title={`Pending deposits (${pendingDeposits.length})`}>
        <AdminDataTable columns={depositColumns()} rows={pendingDeposits} rowKey={(r) => r.id} />
      </Section>
    </InternalPageShell>
  );
}

function depositColumns() {
  return [
    { key: "ref", header: "Ref", cell: (r: InternalBankTransactionRow) => <span className="font-mono text-[11px]">{r.referenceCode}</span> },
    { key: "account", header: "Account", cell: (r: InternalBankTransactionRow) => <span className="font-mono text-[11px]">{r.account}</span> },
    { key: "holder", header: "Holder", cell: (r: InternalBankTransactionRow) => r.holder },
    { key: "amount", header: "Amount", cell: (r: InternalBankTransactionRow) => <span className="type-finance">{r.amount}</span> },
    { key: "submitted", header: "Submitted", cell: (r: InternalBankTransactionRow) => <span className="font-mono text-[11px]">{r.submitted}</span> },
    {
      key: "proof",
      header: "Proof",
      cell: (r: InternalBankTransactionRow) => (
        <BankProofStatus variant="internal" proofImageUrl={r.proofImageUrl} proofFileName={r.proofFileName} proofUploadedAt={r.proofUploadedAt} hasProof={r.hasProof} />
      ),
    },
    { key: "status", header: "Status", cell: (r: InternalBankTransactionRow) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      cell: (r: InternalBankTransactionRow) => (
        <div className="flex flex-wrap gap-1">
          <BankReviewButton label="Approve" variant="primary" onAction={async () => { await approveBankDeposit({ data: { transactionId: r.id } }); }} />
          <BankReviewButton label="Deny" variant="danger" onAction={async () => { await denyBankDeposit({ data: { transactionId: r.id } }); }} />
        </div>
      ),
    },
  ];
}
