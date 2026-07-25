import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { WatchlistPanel } from "@/components/terminal/watchlist";
import { OrdersList } from "@/components/terminal/orders-list";
import { MarketTable } from "@/components/terminal/market-table";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import {
  CreatePortfolioDialog,
  HomePortfolioCard,
} from "@/components/terminal/portfolio-switcher";
import { fetchTerminalHome, fetchEligibleTerminalCompanies } from "@/lib/terminal/terminal.functions";
import { MarketStatusBadge } from "@/components/terminal/market-status";
import { Route as TerminalLayoutRoute } from "./route";

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
  const { mode, dashboard, userDisplayName, eligibleCompanies } = Route.useLoaderData();
  const layout = TerminalLayoutRoute.useLoaderData();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  if (mode === "unavailable" && layout.mode === "unavailable") {
    return <TerminalUnavailableState />;
  }

  const {
    marketStatus,
    combinedValue,
    combinedDayChange,
    combinedDayChangePercent,
    portfolios,
    watchlistPreview,
    movers,
    recentOrders,
  } = dashboard;

  const greetingName = userDisplayName?.trim() || "there";
  const emptyPortfolios = portfolios.length === 0;

  return (
    <div className="space-y-10">
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
            Total value
          </p>
          <MoneyValue value={combinedValue} size="lg" className="mt-1" />
          <div className="mt-1 flex justify-end">
            <PriceChange amount={combinedDayChange} percent={combinedDayChangePercent} />
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <QuickAction href="/terminal/markets" label="Trade" primary />
        <QuickAction href="/terminal/markets" label="View markets" />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-md border border-[var(--terminal-border)] px-3.5 py-2 text-[13px] text-[var(--terminal-text)] hover:border-[var(--terminal-green)]/40"
        >
          Create portfolio
        </button>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-medium">Portfolios</h2>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="text-[12px] text-[var(--terminal-muted)] hover:text-[var(--terminal-green)]"
          >
            New
          </button>
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
          {watchlistPreview.length === 0 ? (
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
    </div>
  );
}

function QuickAction({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={href}
      search={href.includes("/markets") ? { q: "", filter: "all" } : undefined}
      className={
        primary
          ? "rounded-md bg-[var(--terminal-green)] px-3.5 py-2 text-[13px] font-medium text-black"
          : "rounded-md border border-[var(--terminal-border)] px-3.5 py-2 text-[13px] text-[var(--terminal-text)] hover:border-[var(--terminal-green)]/40"
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
