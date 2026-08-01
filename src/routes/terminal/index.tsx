import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { WatchlistPanel } from "@/components/terminal/watchlist";
import { OrdersList } from "@/components/terminal/orders-list";
import { MarketTable } from "@/components/terminal/market-table";
import { CreatePortfolioDialog, HomePortfolioCard } from "@/components/terminal/portfolio-switcher";
import { QuickTradeDialog } from "@/components/terminal/quick-trade-dialog";
import {
  fetchTerminalHome,
  fetchEligibleTerminalCompanies,
} from "@/lib/terminal/terminal.functions";
import { MarketStatusBadge } from "@/components/terminal/market-status";

export const Route = createFileRoute("/terminal/")({
  loader: async () => {
    const [home, eligibleCompanies] = await Promise.all([
      fetchTerminalHome(),
      fetchEligibleTerminalCompanies(),
    ]);
    return { ...home, eligibleCompanies };
  },
  head: () => ({
    meta: [{ title: "Home — Alta Terminal" }],
  }),
  component: TerminalHomePage,
});

function TerminalHomePage() {
  const { dashboard, userDisplayName, eligibleCompanies } = Route.useLoaderData();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [quickTradeOpen, setQuickTradeOpen] = useState(false);
  const tradeButtonRef = useRef<HTMLButtonElement>(null);

  const {
    marketStatus,
    marketDataAvailable,
    combinedValue,
    combinedDayChange,
    combinedDayChangePercent,
    portfolios,
    watchlistPreview,
    movers,
    recentOrders,
  } = dashboard;

  const scheduleHref = portfolios[0]
    ? {
        to: "/terminal/orders" as const,
        search: {
          tab: "scheduled" as const,
          portfolioId: portfolios[0].id,
          status: "all" as const,
          side: "all" as const,
        },
      }
    : {
        to: "/terminal/orders" as const,
        search: { tab: "scheduled" as const, status: "all" as const, side: "all" as const },
      };

  const greetingName = userDisplayName?.trim() || "there";
  const emptyPortfolios = portfolios.length === 0;

  return (
    <div className="space-y-10">
      {!marketDataAvailable ? (
        <div
          role="status"
          className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-3 text-[13px] text-[var(--terminal-muted)]"
        >
          Stock market data is currently unavailable. Your portfolio details and local cash records
          remain available, and Alta crypto trading stays open when those assets are live.
        </div>
      ) : null}

      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--terminal-muted)]">
            Home
          </p>
          <h1 className="mt-1 text-[26px] font-medium tracking-tight sm:text-[30px]">
            Good day, {greetingName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <MarketStatusBadge status={marketStatus.status} label={marketStatus.label} />
            <span className="text-[12px] text-[var(--terminal-muted)]">
              Combined across {portfolios.length} portfolio
              {portfolios.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]">
            {marketDataAvailable ? "Total value" : "Portfolio value"}
          </p>
          {combinedValue == null ? (
            <p className="mt-1 text-[18px] font-medium text-[var(--terminal-muted)]">
              Cash balances unavailable
            </p>
          ) : (
            <>
              <MoneyValue value={combinedValue} size="lg" className="mt-1" animateOnChange />
              {marketDataAvailable ? (
                <div className="mt-1 flex justify-end">
                  <PriceChange amount={combinedDayChange} percent={combinedDayChangePercent} />
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          ref={tradeButtonRef}
          type="button"
          onClick={() => setQuickTradeOpen(true)}
          className="min-h-11 rounded-md bg-[var(--terminal-green)] px-3.5 py-2 text-[13px] font-medium text-black"
        >
          Trade
        </button>
        <Link
          to={scheduleHref.to}
          search={scheduleHref.search}
          className="inline-flex min-h-11 items-center rounded-md border border-[var(--terminal-border)] px-3.5 py-2 text-[13px] text-[var(--terminal-text)] hover:border-[var(--terminal-green)]/40"
        >
          Schedule trade
        </Link>
        {portfolios[0] ? (
          <Link
            to="/bank"
            search={{ action: "terminal-funding", portfolioId: portfolios[0].id }}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--terminal-border)] px-3.5 py-2 text-[13px] text-[var(--terminal-text)] hover:border-[var(--terminal-green)]/40"
          >
            Transfer money
          </Link>
        ) : null}
        <QuickAction href="/terminal/markets" label="View markets" />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="min-h-11 rounded-md border border-[var(--terminal-border)] px-3.5 py-2 text-[13px] text-[var(--terminal-text)] hover:border-[var(--terminal-green)]/40"
        >
          Create portfolio
        </button>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-medium">Portfolios</h2>
        </div>
        {emptyPortfolios ? (
          <div className="rounded-lg border border-[var(--terminal-border)] px-4 py-8">
            <h3 className="text-[16px] font-medium">Create your first portfolio</h3>
            <p className="mt-2 max-w-xl text-[13px] text-[var(--terminal-muted)]">
              Portfolios keep cash, holdings, and orders separate. Start with a personal account or
              create one for a company you represent.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex rounded-md bg-[var(--terminal-green)] px-4 py-2 text-[13px] font-medium text-black"
            >
              Create portfolio
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {portfolios.map((p) => (
              <HomePortfolioCard key={p.id} portfolio={p} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHeader title="Watchlist" href="/terminal/watchlist" />
          {!marketDataAvailable ? (
            <EmptyHint message="Watchlist quotes are unavailable while market data is offline." />
          ) : watchlistPreview.length === 0 ? (
            <EmptyHint message="Your watchlist is empty. Add symbols from Markets." />
          ) : (
            <WatchlistPanel items={watchlistPreview} />
          )}
        </section>
        <section>
          <SectionHeader title="Recent activity" href="/terminal/orders" />
          {recentOrders.length === 0 ? (
            <EmptyHint message="No recent orders across your portfolios." />
          ) : (
            <OrdersList orders={recentOrders} />
          )}
        </section>
      </div>

      {marketDataAvailable && (movers.gainers.length > 0 || movers.losers.length > 0) ? (
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

      <CreatePortfolioDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        eligibleCompanies={eligibleCompanies}
        onCreated={(p) => {
          void navigate({
            to: "/terminal/portfolio/$portfolioId",
            params: { portfolioId: p.id },
            search: { range: "1D" },
          });
        }}
      />

      <QuickTradeDialog
        open={quickTradeOpen}
        onOpenChange={setQuickTradeOpen}
        initialPortfolios={portfolios}
        onCloseAutoFocus={() => {
          tradeButtonRef.current?.focus({ preventScroll: true });
        }}
      />
    </div>
  );
}

function QuickAction({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link
      to={href}
      search={href.includes("/markets") ? { q: "", filter: "all" } : undefined}
      className={
        primary
          ? "inline-flex min-h-11 items-center rounded-md bg-[var(--terminal-green)] px-3.5 py-2 text-[13px] font-medium text-black"
          : "inline-flex min-h-11 items-center rounded-md border border-[var(--terminal-border)] px-3.5 py-2 text-[13px] text-[var(--terminal-text)] hover:border-[var(--terminal-green)]/40"
      }
    >
      {label}
    </Link>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-[var(--terminal-border)] px-4 py-6 text-[13px] text-[var(--terminal-muted)]">
      {message}
    </p>
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
