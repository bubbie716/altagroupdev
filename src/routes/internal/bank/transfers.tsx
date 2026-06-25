import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalScheduledTransfersPanel } from "@/components/bank/internal-scheduled-transfers-panel";
import { fetchInternalScheduledTransfers } from "@/lib/bank/scheduled-transfer-admin.functions";

export const Route = createFileRoute("/internal/bank/transfers")({
  loader: () => fetchInternalScheduledTransfers(),
  head: () => ({ meta: [{ title: "Transfer Operations — Alta Internal" }] }),
  component: InternalTransfers,
});

function InternalTransfers() {
  const scheduled = Route.useLoaderData();
  const failed = scheduled.filter((s) => s.status === "failed");
  const active = scheduled.filter((s) => ["approved", "paused", "pending_review"].includes(s.status));

  return (
    <InternalPageShell
      title="Transfer Operations"
      description="Scheduled intrabank transfers, failures, and manual execution controls."
    >
      <Link to="/internal/bank" className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline">
        ← Bank ops
      </Link>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="All scheduled" value={String(scheduled.length)} />
        <Stat label="Active / paused" value={String(active.length)} />
        <Stat label="Failed" value={String(failed.length)} alert={failed.length > 0} />
      </div>

      <Section title="Scheduled transfers">
        <InternalScheduledTransfersPanel transfers={scheduled} />
      </Section>

      <Section title="Alta Pay & payroll" className="mt-10">
        <p className="text-[13px] text-muted-foreground">
          Alta Pay received payments are visible on business account pages. Payroll execution runs with the scheduled
          transfer batch via <span className="font-mono text-[11px]">Run due transfers</span> on Bank Ops.
        </p>
      </Section>
    </InternalPageShell>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-md border px-4 py-3 ${alert ? "border-amber-500/40 bg-amber-500/5" : "border-border/60 bg-surface-1/60"}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular">{value}</div>
    </div>
  );
}
