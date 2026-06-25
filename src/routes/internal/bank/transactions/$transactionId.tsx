import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { InternalNotePanel } from "@/components/internal/internal-note-panel";
import { fetchTransactionDetail } from "@/lib/internal/ops-platform.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";
import { florin } from "@/lib/bank/api";

export const Route = createFileRoute("/internal/bank/transactions/$transactionId")({
  loader: async ({ params }) => {
    const [tx, audit, notes] = await Promise.all([
      fetchTransactionDetail({ data: params.transactionId }),
      fetchAuditLogsForEntity({ data: { entityType: "BANK_TRANSACTION", entityId: params.transactionId } }),
      fetchInternalNotes({ data: { targetType: "BANK_TRANSACTION", targetId: params.transactionId } }),
    ]);
    return { tx, audit, notes };
  },
  component: TransactionDetailPage,
});

function TransactionDetailPage() {
  const { tx, audit, notes } = Route.useLoaderData();

  return (
    <InternalPageShell title={tx.referenceCode} description={`${tx.type} · ${tx.status}`}>
      <Link to="/internal/bank/transactions" className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline">
        ← Transaction explorer
      </Link>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Amount" value={florin(tx.amount)} />
        <Metric label="Account" value={tx.accountNumber} mono />
        <Metric label="Holder" value={tx.holder} />
        <Metric label="Date" value={tx.createdAt.slice(0, 19).replace("T", " ")} mono />
      </div>

      <p className="mb-6 text-[13px] text-muted-foreground">{tx.description}</p>
      {tx.memo ? <p className="mb-4 text-[13px]">Memo: {tx.memo}</p> : null}
      {tx.reviewNote ? <p className="mb-4 text-[13px]">Review note: {tx.reviewNote}</p> : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <Link to="/internal/bank/accounts/$accountId" params={{ accountId: tx.accountId }} className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase text-gold">
          View account
        </Link>
        {tx.relatedLoanId ? (
          <Link to="/internal/lending/loans/$loanId" params={{ loanId: tx.relatedLoanId }} className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase text-gold">
            View loan
          </Link>
        ) : null}
        {tx.relatedAltaPayRef ? (
          <Link to="/internal/bank/alta-pay" search={{ ref: tx.relatedAltaPayRef }} className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase text-gold">
            Alta Pay
          </Link>
        ) : null}
      </div>

      {tx.linkedTransactions.length > 0 && (
        <Section title="Linked transactions">
          <ul className="space-y-2 text-[13px]">
            {tx.linkedTransactions.map((l) => (
              <li key={l.id}>
                <Link to="/internal/bank/transactions/$transactionId" params={{ transactionId: l.id }} className="font-mono hover:text-gold">
                  {l.referenceCode}
                </Link>{" "}
                · {l.type} · {florin(l.amount)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Internal notes" className="mt-10">
        <InternalNotePanel targetType="BANK_TRANSACTION" targetId={tx.id} initialNotes={notes} />
      </Section>

      <Section title="Audit history" className="mt-10">
        <InternalAuditTable rows={audit} />
      </Section>
    </InternalPageShell>
  );
}

function Metric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/20 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${mono ? "font-mono text-[13px]" : "tabular"}`}>{value}</div>
    </div>
  );
}
