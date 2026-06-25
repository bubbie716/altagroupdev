import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { InternalStatementBatchButton } from "@/components/bank/internal-statement-ops";
import { fetchInternalStatementOps } from "@/lib/bank/statement.functions";
import type { BankStatementSummary } from "@/lib/bank/statement-types";

export const Route = createFileRoute("/internal/bank/statements")({
  loader: () => fetchInternalStatementOps(),
  head: () => ({ meta: [{ title: "Statements — Alta Internal" }] }),
  component: InternalStatements,
});

function InternalStatements() {
  const statementOps = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Statement Operations"
      description="Batch-generate monthly statements and review recent statement output."
    >
      <Link to="/internal/bank" className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline">
        ← Bank ops
      </Link>

      <Section title="Batch generation">
        <div className="rounded-lg border border-border/60 bg-surface-2/30 p-5">
          <InternalStatementBatchButton />
          <p className="mt-3 text-[12px] text-muted-foreground">{statementOps.errorPlaceholder}</p>
        </div>
      </Section>

      <Section title="Recent statements" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "number", header: "Statement", cell: (s: BankStatementSummary) => <span className="font-mono text-[11px]">{s.statementNumber}</span> },
            { key: "account", header: "Account", cell: (s: BankStatementSummary) => <span className="font-mono text-[11px]">{s.accountNumber}</span> },
            { key: "holder", header: "Holder", cell: (s: BankStatementSummary) => s.ownerLabel },
            { key: "period", header: "Period end", cell: (s: BankStatementSummary) => s.periodEnd.slice(0, 10) },
            { key: "status", header: "Status", cell: (s: BankStatementSummary) => <StatusBadge status={s.statusLabel} /> },
            {
              key: "view",
              header: "",
              cell: (s: BankStatementSummary) => (
                <Link to="/bank/statements/$statementId" params={{ statementId: s.id }} className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline">
                  View
                </Link>
              ),
            },
          ]}
          rows={statementOps.recentStatements}
          rowKey={(s) => s.id}
        />
        <p className="mt-4 text-[13px] text-muted-foreground">Voided statements: {statementOps.voidedCount}</p>
      </Section>
    </InternalPageShell>
  );
}
