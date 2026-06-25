"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { BankProofStatus } from "@/components/bank/bank-proof-link";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";
import {
  approveBankDeposit,
  denyBankDeposit,
} from "@/lib/bank/bank.functions";
import { bulkApproveDepositsOps } from "@/lib/internal/ops-platform.functions";
import type { InternalBankTransactionRow } from "@/lib/bank/backend-types";

export function InternalDepositsQueue({ pendingDeposits }: { pendingDeposits: InternalBankTransactionRow[] }) {
  const router = useRouter();
  const bulkFn = useServerFn(bulkApproveDepositsOps);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pendingDeposits;
    return pendingDeposits.filter(
      (r) =>
        r.referenceCode.toLowerCase().includes(q) ||
        r.account.toLowerCase().includes(q) ||
        r.holder.toLowerCase().includes(q),
    );
  }, [pendingDeposits, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <InternalPageShell
      title="Deposit Review"
      description="Approve or deny pending deposit requests with proof verification."
    >
      <Link to="/internal/bank" className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline">
        ← Bank ops
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search ref, account, holder…"
          className="min-w-[220px] flex-1 rounded-md border border-border px-3 py-2 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {selected.size > 0 && (
          <button
            type="button"
            className="rounded border border-gold/30 px-3 py-1.5 font-mono text-[10px] uppercase text-gold"
            onClick={() => setBulkOpen(true)}
          >
            Approve selected ({selected.size})
          </button>
        )}
      </div>

      <Section title={`Pending deposits (${filtered.length})`}>
        <AdminDataTable
          columns={[
            {
              key: "sel",
              header: "",
              cell: (r) => (
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.referenceCode}`} />
              ),
            },
            ...depositColumns(),
          ]}
          rows={filtered}
          rowKey={(r) => r.id}
        />
      </Section>

      <OpsConfirmDialog
        open={bulkOpen}
        title="Bulk approve deposits"
        description={`Approve ${selected.size} pending deposit(s). Each approval will post to the ledger.`}
        confirmLabel="Approve all"
        onCancel={() => setBulkOpen(false)}
        onConfirm={async (reason) => {
          await bulkFn({ data: { transactionIds: [...selected], reviewNote: reason } });
          setSelected(new Set());
          setBulkOpen(false);
          await router.invalidate();
        }}
      />
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
