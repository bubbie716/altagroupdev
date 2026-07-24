import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PortfolioChart } from "@/components/terminal/portfolio-chart";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { HoldingsTable } from "@/components/terminal/holdings-table";
import { WatchlistPanel } from "@/components/terminal/watchlist";
import { OrdersList } from "@/components/terminal/orders-list";
import { MarketTable } from "@/components/terminal/market-table";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import { fetchTerminalHome } from "@/lib/terminal/terminal.functions";
import { Route as TerminalLayoutRoute } from "./route";

export const Route = createFileRoute("/terminal/")({
  loader: async () => fetchTerminalHome(),
  head: () => ({
    meta: [{ title: "Home — Alta Terminal" }],
  }),
  component: TerminalHomePage,
});

function TerminalHomePage() {
  const { mode, dashboard } = Route.useLoaderData();
  const layout = TerminalLayoutRoute.useLoaderData();

  if (mode === "unavailable" && layout.mode === "unavailable") {
    return <TerminalUnavailableState />;
  }

  const { portfolio, watchlistPreview, movers, recentOrders } = dashboard;
  const empty = portfolio.holdings.length === 0;

  return (
    <div className="space-y-10">
      <PortfolioChart
        seriesByRange={portfolio.seriesByRange}
        equityValue={portfolio.equityValue + portfolio.cashBalance}
        dayChange={portfolio.dayChange}
        dayChangePercent={portfolio.dayChangePercent}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Buying power"
          value={<MoneyValue value={portfolio.buyingPower} size="md" />}
        />
        <Metric
          label="Day change"
          value={<PriceChange amount={portfolio.dayChange} percent={portfolio.dayChangePercent} />}
        />
        <Metric label="Cash" value={<MoneyValue value={portfolio.cashBalance} size="md" />} />
      </div>

      {empty ? (
        <section className="rounded-lg border border-[var(--terminal-border)] px-4 py-8">
          <h2 className="text-[16px] font-medium">Build your portfolio</h2>
          <p className="mt-2 max-w-xl text-[13px] text-[var(--terminal-muted)]">
            You do not hold any securities yet. Browse markets to discover names trading on Newport
            TSE.
          </p>
          <Link
            to="/terminal/markets"
            search={{ q: "", filter: "all" }}
            className="mt-4 inline-flex rounded-md bg-[var(--terminal-green)] px-4 py-2 text-[13px] font-medium text-black"
          >
            Explore markets
          </Link>
          <div className="mt-8">
            <SectionHeader title="Market movers" href="/terminal/markets" />
            <MarketTable rows={[...movers.gainers, ...movers.losers].slice(0, 6)} />
          </div>
        </section>
      ) : (
        <section>
          <SectionHeader title="Holdings" href="/terminal/portfolio" />
          <HoldingsTable holdings={portfolio.holdings.slice(0, 5)} />
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHeader title="Watchlist" href="/terminal/watchlist" />
          <WatchlistPanel items={watchlistPreview} />
        </section>
        <section>
          <SectionHeader title="Recent activity" href="/terminal/orders" />
          <OrdersList orders={recentOrders} />
        </section>
      </div>

      {!empty ? (
        <section>
          <SectionHeader title="Market movers" href="/terminal/markets" />
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[12px] text-[var(--terminal-muted)]">Gainers</p>
              <MarketTable rows={movers.gainers} />
            </div>
            <div>
              <p className="mb-2 text-[12px] text-[var(--terminal-muted)]">Losers</p>
              <MarketTable rows={movers.losers} />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]">
        {label}
      </p>
      <div className="mt-2">{value}</div>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-medium">{title}</h2>
      <Link
        to={href}
        className="text-[12px] text-[var(--terminal-muted)] hover:text-[var(--terminal-green)]"
      >
        View all
      </Link>
    </div>
  );
}
