import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PortfolioChart } from "@/components/terminal/portfolio-chart";
import { MoneyValue } from "@/components/terminal/money-value";
import { AllocationBars, HoldingsTable } from "@/components/terminal/holdings-table";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import { fetchTerminalPortfolio } from "@/lib/terminal/terminal.functions";

export const Route = createFileRoute("/terminal/portfolio")({
  loader: async () => fetchTerminalPortfolio(),
  head: () => ({ meta: [{ title: "Portfolio — Alta Terminal" }] }),
  component: TerminalPortfolioPage,
});

function TerminalPortfolioPage() {
  const { mode, portfolio } = Route.useLoaderData();

  if (mode === "unavailable") {
    return <TerminalUnavailableState />;
  }

  return (
    <div className="space-y-8">
      <PortfolioChart
        seriesByRange={portfolio.seriesByRange}
        equityValue={portfolio.equityValue + portfolio.cashBalance}
        dayChange={portfolio.dayChange}
        dayChangePercent={portfolio.dayChangePercent}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Invested"
          value={<MoneyValue value={portfolio.equityValue} size="md" />}
        />
        <SummaryCard label="Cash" value={<MoneyValue value={portfolio.cashBalance} size="md" />} />
        <SummaryCard
          label="Buying power"
          value={<MoneyValue value={portfolio.buyingPower} size="md" />}
        />
      </div>

      <section>
        <h2 className="mb-3 text-[15px] font-medium">Holdings</h2>
        <HoldingsTable holdings={portfolio.holdings} />
      </section>

      {portfolio.holdings.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[15px] font-medium">Allocation</h2>
          <AllocationBars holdings={portfolio.holdings} />
        </section>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]">
        {label}
      </p>
      <div className="mt-2">{value}</div>
    </div>
  );
}
