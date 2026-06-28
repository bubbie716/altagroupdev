import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { fetchInternalComplianceSnapshot } from "@/lib/internal/internal-dashboard.functions";
import { auditFilterHref } from "@/lib/internal/audit-links";

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
      description="Live operational risk signals. Full compliance case management is not yet implemented — use signals and the audit log for investigations."
    >
      <OpsSection title="Live risk signals">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Signal label="Frozen bank accounts" value={String(s.frozenAccounts)} to="/internal/bank/accounts" hint="Account workspace" />
          <Signal label="Restricted users" value={String(s.restrictedUsers)} to="/internal/users" hint="Customer workspace" />
          <Signal label="Frozen users" value={String(s.frozenUsers)} to="/internal/users" hint="Customer workspace" />
          <Signal label="Failed scheduled transfers" value={String(s.failedScheduledTransfers)} to="/internal/bank/scheduled" hint="Scheduled transfers" />
          <Signal label="Denied withdrawals (30d)" value={String(s.deniedWithdrawalsLast30Days)} to="/internal/queues/withdrawals" hint="Withdrawals queue" />
          <Signal
            label="Large adjustments (30d)"
            value={String(s.largeAdjustmentsLast30Days)}
            to={auditFilterHref({ action: "ADJUSTMENT" })}
            hint="Filtered audit log"
          />
          <Signal label="Pending deposits" value={String(s.pendingDeposits)} to="/internal/queues/deposits" hint="Deposits queue" />
          <Signal label="Pending withdrawals" value={String(s.pendingWithdrawals)} to="/internal/queues/withdrawals" hint="Withdrawals queue" />
          <Signal label="Pending account openings" value={String(s.pendingAccountOpenings)} to="/internal/queues/account-openings" hint="Openings queue" />
        </div>
      </OpsSection>

      <OpsSection title="Compliance cases" className="mt-8">
        <div className="rounded-lg border border-border/60 bg-surface-1/60 p-5 text-[13px] text-muted-foreground">
          Structured compliance case workflow (assign, escalate, resolve) is not backed by a database model yet.
          Use the signals above, customer/account workspaces, and the{" "}
          <Link to="/internal/audit" className="text-gold hover:underline">
            audit log
          </Link>{" "}
          for investigations today.
        </div>
      </OpsSection>
    </InternalPageShell>
  );
}

function Signal({
  label,
  value,
  to,
  hint,
}: {
  label: string;
  value: string;
  to: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-4 transition-colors hover:border-gold/40"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </Link>
  );
}
