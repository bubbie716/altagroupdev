import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
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
        <p className="text-[13px] text-muted-foreground">
          Monthly statement cron and manual batch runs are on{" "}
          <Link to="/internal/jobs" className="text-gold hover:underline">
            System Jobs
          </Link>
          . Voided statements (30d): {statementOps.voidedCount}.
        </p>
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
                <Link to="/internal/bank/accounts/$accountId" params={{ accountId: s.bankAccountId }} search={{ tab: "statements" }} className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline">
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
