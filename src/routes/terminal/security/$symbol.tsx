import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SecurityChart } from "@/components/terminal/portfolio-chart";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { SecurityStatusBadge } from "@/components/terminal/market-status";
import { OrderTicket } from "@/components/terminal/order-ticket";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import { PortfolioSwitcher } from "@/components/terminal/portfolio-switcher";
import {
  addTerminalWatchlistSymbol,
  fetchEligibleTerminalCompanies,
  fetchTerminalSecurity,
  removeTerminalWatchlistSymbol,
} from "@/lib/terminal/terminal.functions";
import { formatCompactVolume, formatMarketCap, formatTerminalMoney } from "@/lib/terminal/format";
import type { TerminalChartRange } from "@/lib/terminal/types";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";

export const Route = createFileRoute("/terminal/security/$symbol")({
  validateSearch: (search: Record<string, unknown>) => ({
    range:
      typeof search.range === "string" &&
      ["1D", "1W", "1M", "3M", "1Y", "ALL"].includes(search.range)
        ? (search.range as TerminalChartRange)
        : ("1D" as TerminalChartRange),
    portfolioId: typeof search.portfolioId === "string" ? search.portfolioId : undefined,
  }),
  // Only portfolio changes should reload the route — chart ranges switch client-side.
  loaderDeps: ({ search }) => ({ portfolioId: search.portfolioId }),
  loader: async ({ params, deps }) => {
    const [data, eligibleCompanies] = await Promise.all([
      fetchTerminalSecurity({
        data: {
          symbol: params.symbol,
          portfolioId: deps.portfolioId,
        },
      }),
      fetchEligibleTerminalCompanies(),
    ]);
    if (!data.security && data.mode !== "unavailable") throw notFound();
    return { ...data, eligibleCompanies };
  },
  head: ({ loaderData, params }) => ({
    meta: [
      {
        title: loaderData?.security
          ? `${loaderData.security.symbol} — Alta Terminal`
          : `${params.symbol.toUpperCase()} — Alta Terminal`,
      },
    ],
  }),
  component: TerminalSecurityPage,
});

function TerminalSecurityPage() {
  const data = Route.useLoaderData();
  const { range: initialRange } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const addWatch = useServerFn(addTerminalWatchlistSymbol);
  const removeWatch = useServerFn(removeTerminalWatchlistSymbol);
  const [watchBusy, setWatchBusy] = useState(false);

  if (data.mode === "unavailable") {
    return <TerminalUnavailableState />;
  }

  const security = data.security;
  if (!security) {
    return (
      <div className="rounded-lg border border-[var(--terminal-border)] px-4 py-10 text-center">
        <h1 className="text-[20px] font-medium">Unknown symbol</h1>
        <p className="mt-2 text-[13px] text-[var(--terminal-muted)]">
          We could not find a security for this symbol.
        </p>
      </div>
    );
  }

  const marketClosed =
    data.marketStatus.status === "closed" || data.marketStatus.status === "holiday";
  const portfolioId = data.selectedPortfolio?.id ?? null;
  const portfolioLabel = data.selectedPortfolio
    ? `${data.selectedPortfolio.name} · ${data.selectedPortfolio.ownerLabel}`
    : null;

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[28px] font-medium tracking-tight sm:text-[34px]">
                {security.symbol}
              </h1>
              <SecurityStatusBadge status={security.tradingStatus} />
            </div>
            <p className="mt-1 text-[14px] text-[var(--terminal-muted)]">{security.name}</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <MoneyValue value={security.lastPrice} asPrice size="lg" />
              <PriceChange amount={security.dayChange} percent={security.dayChangePercent} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <PortfolioSwitcher
              portfolios={data.portfolios}
              selectedId={portfolioId}
              eligibleCompanies={data.eligibleCompanies}
              compact
              onSelect={(id) => {
                void navigate({
                  search: (prev) => ({ ...prev, portfolioId: id }),
                  replace: true,
                });
              }}
              onCreated={(p) => {
                void navigate({
                  search: (prev) => ({ ...prev, portfolioId: p.id }),
                  replace: true,
                });
              }}
            />
            <button
              type="button"
              disabled={watchBusy}
              onClick={() => {
                setWatchBusy(true);
                void (
                  data.onWatchlist
                    ? removeWatch({ data: security.symbol })
                    : addWatch({ data: security.symbol })
                )
                  .then(() => invalidateRouteData(router))
                  .finally(() => setWatchBusy(false));
              }}
              className="rounded-md border border-[var(--terminal-border)] px-3 py-2 text-[12px] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]"
            >
              {data.onWatchlist ? "Remove from watchlist" : "Add to watchlist"}
            </button>
          </div>
        </div>

        <SecurityChart
          seriesByRange={data.historyByRange}
          initialRange={initialRange}
          positive={security.dayChange >= 0}
        />

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Open" value={formatTerminalMoney(security.open)} />
          <Stat label="High" value={formatTerminalMoney(security.high)} />
          <Stat label="Low" value={formatTerminalMoney(security.low)} />
          <Stat label="Prev close" value={formatTerminalMoney(security.previousClose)} />
          <Stat label="Volume" value={formatCompactVolume(security.volume)} />
          <Stat label="Market cap" value={formatMarketCap(security.marketCap)} />
        </dl>

        {data.position ? (
          <section className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-4">
            <h2 className="text-[13px] text-[var(--terminal-muted)]">Your position</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Shares" value={String(data.position.quantity)} />
              <Stat label="Avg cost" value={formatTerminalMoney(data.position.averageCost)} />
              <Stat label="Market value" value={formatTerminalMoney(data.position.marketValue)} />
              <Stat
                label="Total return"
                value={`${formatTerminalMoney(data.position.totalReturn, { signed: true })} (${data.position.totalReturnPercent.toFixed(2)}%)`}
              />
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="text-[15px] font-medium">About</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--terminal-muted)]">
            {security.description}
          </p>
          <p className="mt-2 text-[12px] text-[var(--terminal-muted)]">
            Sector · {security.sector}
          </p>
        </section>
      </div>

      <aside className="hidden lg:sticky lg:top-20 lg:block">
        <OrderTicket
          security={security}
          buyingPower={data.buyingPower}
          position={data.position}
          mode={data.mode}
          marketClosed={marketClosed}
          portfolioId={portfolioId}
          portfolioLabel={portfolioLabel}
          onSubmitted={() => void invalidateRouteData(router)}
        />
      </aside>

      <div className="fixed inset-x-0 bottom-[52px] z-30 border-t border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-3 md:bottom-0 lg:hidden">
        <OrderTicket
          security={security}
          buyingPower={data.buyingPower}
          position={data.position}
          mode={data.mode}
          marketClosed={marketClosed}
          portfolioId={portfolioId}
          portfolioLabel={portfolioLabel}
          compact
          onSubmitted={() => void invalidateRouteData(router)}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--terminal-border)] px-3 py-2.5">
      <dt className="text-[11px] text-[var(--terminal-muted)]">{label}</dt>
      <dd className="mt-1 text-[13px] tabular-nums">{value}</dd>
    </div>
  );
}
