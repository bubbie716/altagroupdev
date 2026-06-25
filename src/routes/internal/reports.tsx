import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { fetchOpsDailyReports } from "@/lib/internal/ops-platform.functions";
import { florin } from "@/lib/bank/api";

export const Route = createFileRoute("/internal/reports")({
  loader: () => fetchOpsDailyReports(),
  head: () => ({ meta: [{ title: "Operational Reports — Alta Internal" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const reports = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Operational Reports"
      description="Today's banking activity — deposits, withdrawals, lending, Alta Pay, and adjustments."
    >
      <Section title="Today">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(reports).map((row) => (
            <InternalStatCard
              key={row.label}
              label={row.label}
              value={florin(row.totalAmount)}
              sub={`${row.count} transaction(s)`}
            />
          ))}
        </div>
      </Section>
    </InternalPageShell>
  );
}
