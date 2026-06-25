import { createFileRoute, Link } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { fetchInternalComplianceSnapshot } from "@/lib/internal/internal-dashboard.functions";

export const Route = createFileRoute("/internal/compliance")({
  loader: () => fetchInternalComplianceSnapshot(),
  head: () => ({ meta: [{ title: "Compliance — Alta Internal" }] }),
  component: InternalCompliance,
});

function InternalCompliance() {
  const s = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Compliance"
      description="Operational risk signals from live banking and identity data. Full case management is not yet implemented."
    >
      <Section title="Live risk signals">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Signal label="Frozen bank accounts" value={String(s.frozenAccounts)} to="/internal/bank/accounts" />
          <Signal label="Restricted users" value={String(s.restrictedUsers)} to="/internal/users" />
          <Signal label="Frozen users" value={String(s.frozenUsers)} to="/internal/users" />
          <Signal label="Failed scheduled transfers" value={String(s.failedScheduledTransfers)} to="/internal/bank/transfers" />
          <Signal label="Denied withdrawals (30d)" value={String(s.deniedWithdrawalsLast30Days)} to="/internal/bank/withdrawals" />
          <Signal label="Large adjustments (30d)" value={String(s.largeAdjustmentsLast30Days)} to="/internal/audit" />
          <Signal label="Pending deposits" value={String(s.pendingDeposits)} to="/internal/bank/deposits" />
          <Signal label="Pending withdrawals" value={String(s.pendingWithdrawals)} to="/internal/bank/withdrawals" />
          <Signal label="Pending account openings" value={String(s.pendingAccountOpenings)} to="/internal/bank" />
        </div>
      </Section>

      <Section title="Compliance cases" className="mt-10">
        <Card className="!p-6 text-[13px] text-muted-foreground">
          Structured compliance case workflow (assign, escalate, resolve) is not yet backed by a database model.
          Use the signals above and the{" "}
          <Link to="/internal/audit" className="text-gold hover:underline">
            audit log
          </Link>{" "}
          for investigations today.
        </Card>
      </Section>
    </InternalPageShell>
  );
}

function Signal({ label, value, to }: { label: string; value: string; to: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-4 transition-colors hover:border-gold/40"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular">{value}</div>
    </Link>
  );
}
