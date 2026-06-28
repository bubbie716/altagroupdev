import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsQueueCard } from "@/components/internal/ops-queue-card";
import { OpsSection } from "@/components/internal/console";
import { fetchInternalLendingOps } from "@/lib/bank/lending.functions";

export const Route = createFileRoute("/internal/lending/")({
  loader: () => fetchInternalLendingOps(),
  head: () => ({ meta: [{ title: "Lending — Alta Internal" }] }),
  component: InternalLending,
});

function InternalLending() {
  const { applications, activeLoans, paidOffLoans, frozenLoans } = Route.useLoaderData();
  const pending = applications.filter(
    (a) => a.status === "pending" || a.status === "under_review",
  ).length;

  return (
    <InternalPageShell title="Lending">
      <OpsSection title="Operational queues">
        <div className="grid gap-3 sm:grid-cols-2">
          <OpsQueueCard
            label="Open applications"
            count={pending}
            to="/internal/queues/lending-applications"
            cta="Open queue"
            tone={pending > 0 ? "alert" : "neutral"}
          />
          <OpsQueueCard
            label="Deal room inbox"
            count={pending}
            to="/internal/queues/deal-rooms"
            cta="Inbox"
          />
        </div>
      </OpsSection>

      <OpsSection title="Portfolio snapshot">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Active" value={String(activeLoans.length)} />
          <Metric label="Frozen" value={String(frozenLoans.length)} />
          <Metric label="Paid off" value={String(paidOffLoans.length)} />
        </div>
      </OpsSection>

      <OpsSection title="Loan servicing">
        <p className="text-[12px] text-muted-foreground">
          Interest accrual and auto-pay batch jobs run via the daily servicing cron. Monitor and trigger
          manual runs from{" "}
          <Link to="/internal/jobs" className="text-gold hover:underline">
            System Jobs
          </Link>
          .
        </p>
      </OpsSection>
    </InternalPageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/80 bg-surface-1/40 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
