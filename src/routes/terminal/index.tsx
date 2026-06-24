import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { TerminalSubNav } from "@/components/terminal/terminal-sub-nav";
import { TerminalStatCard } from "@/components/terminal/terminal-stat-card";
import { HoldingsTable } from "@/components/terminal/holdings-table";
import { WatchlistTable } from "@/components/terminal/watchlist-table";
import { NewsFeed } from "@/components/terminal/news-feed";
import { IPOAccessCard } from "@/components/terminal/ipo-access-card";
import { PortfolioChart } from "@/components/terminal/portfolio-chart";
import { EmptyPortfolioState } from "@/components/data/empty-portfolio-state";
import { MockDataNotice } from "@/components/data/mock-data-notice";
import { movers } from "@/lib/mock-data";
import {
  florin,
  getHoldings,
  getOrders,
  getTerminalDashboard,
  getTerminalDescription,
  getTerminalIpoAccess,
  getTerminalNews,
  getWatchlistGroups,
  pct,
} from "@/lib/terminal/api";
import { isPublicSimulatedMarketDataEnabled, isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/terminal/")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [
      { title: "Alta Terminal — Invest Like the 1%" },
      { name: "description", content: getTerminalDescription() },
    ],
  }),
  component: TerminalHome,
});

function TerminalHome() {
  const showMockData = isUserFinancialMockDataEnabled();
  const showMarketPreview = isPublicSimulatedMarketDataEnabled();
  const terminalDescription = getTerminalDescription();

  return (
    <PageShell
      eyebrow="Alta Terminal"
      title="Invest Like the 1%"
      description={terminalDescription}
    >
      <TerminalSubNav />

      {showMockData ? (
        <TerminalHomeMockContent />
      ) : (
        <>
          <EmptyPortfolioState />
          {showMarketPreview && <TerminalMarketPreviewSections />}
        </>
      )}
    </PageShell>
  );
}

function TerminalHomeMockContent() {
  const d = getTerminalDashboard();
  const watchlistGroups = getWatchlistGroups();
  const terminalIpoAccess = getTerminalIpoAccess();
  const terminalNews = getTerminalNews();
  const holdings = getHoldings();
  const orders = getOrders();

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TerminalStatCard label="Total Net Worth" value={florin(d.totalNetWorth)} className="lg:col-span-1" />
        <TerminalStatCard label="Portfolio Value" value={florin(d.portfolioValue)} />
        <TerminalStatCard
          label="Daily P&L"
          value={`+${florin(d.dailyPnL)}`}
          sub={pct(d.dailyPnLPercent)}
          accent
        />
        <TerminalStatCard label="Cash Available" value={florin(d.cashAvailable)} />
      </div>

      <Section title="Portfolio Performance" className="mt-10">
        <Card>
          <PortfolioChart data={d.performanceSeries} gradientId="terminalHome" />
        </Card>
      </Section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Section title="Open Orders">
          <Card className="!p-0">
            <div className="w-full overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left type-meta">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Side</th>
                  <th className="px-5 py-3">Symbol</th>
                  <th className="px-5 py-3 text-right">Qty</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.filter((o) => o.status === "Working").map((o) => (
                  <tr key={o.id} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{o.id}</td>
                    <td className={`px-5 py-3 font-mono text-[12px] ${o.side === "BUY" ? "ticker-up" : "ticker-down"}`}>
                      {o.side}
                    </td>
                    <td className="px-5 py-3 font-mono">{o.symbol}</td>
                    <td className="tabular px-5 py-3 text-right">{o.qty}</td>
                    <td className="px-5 py-3 font-mono text-[11px] text-gold">{o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
        </Section>

        <Section
          title="Watchlist Preview"
          action={
            <Link to="/terminal/watchlist" className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline">
              Full watchlist →
            </Link>
          }
        >
          <WatchlistTable items={watchlistGroups[0].items.slice(0, 4)} />
        </Section>
      </div>

      <Section title="Market Movers" className="mt-10">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <div className="type-meta">Top Gainers</div>
            <ul className="mt-4 space-y-3">
              {movers.gainers.slice(0, 5).map((s) => (
                <li key={s.symbol} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0">
                  <span className="font-mono">{s.symbol}</span>
                  <span className="ticker-up font-mono text-[12px]">{pct(s.change)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <div className="type-meta">Top Losers</div>
            <ul className="mt-4 space-y-3">
              {movers.losers.slice(0, 5).map((s) => (
                <li key={s.symbol} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0">
                  <span className="font-mono">{s.symbol}</span>
                  <span className="ticker-down font-mono text-[12px]">{pct(s.change)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      <Section
        title="IPO Access Preview"
        className="mt-10"
        action={
          <Link to="/terminal/ipo" className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline">
            IPO Access →
          </Link>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {terminalIpoAccess.map((ipo) => (
            <IPOAccessCard
              key={ipo.ticker}
              company={ipo.company}
              ticker={ipo.ticker}
              status={ipo.status}
              allocationStatus={ipo.allocationStatus}
              detail={ipo.offeringPrice ?? ipo.expectedPrice ?? ipo.listingPrice}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Market News"
        className="mt-10"
        action={
          <Link to="/terminal/news" className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline">
            All news →
          </Link>
        }
      >
        <NewsFeed items={terminalNews.slice(0, 4)} />
      </Section>

      <Section title="Holdings Snapshot" className="mt-10">
        <HoldingsTable rows={holdings.slice(0, 4)} />
      </Section>
    </>
  );
}

function TerminalMarketPreviewSections() {
  const terminalIpoAccess = getTerminalIpoAccess();
  const terminalNews = getTerminalNews();

  return (
    <>
      <MockDataNotice className="mt-10" />

      <Section title="Market Movers" className="mt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <div className="type-meta">Top Gainers</div>
            <ul className="mt-4 space-y-3">
              {movers.gainers.slice(0, 5).map((s) => (
                <li key={s.symbol} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0">
                  <span className="font-mono">{s.symbol}</span>
                  <span className="ticker-up font-mono text-[12px]">{pct(s.change)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <div className="type-meta">Top Losers</div>
            <ul className="mt-4 space-y-3">
              {movers.losers.slice(0, 5).map((s) => (
                <li key={s.symbol} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0">
                  <span className="font-mono">{s.symbol}</span>
                  <span className="ticker-down font-mono text-[12px]">{pct(s.change)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      <Section
        title="IPO Access Preview"
        className="mt-10"
        action={
          <Link to="/terminal/ipo" className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline">
            IPO Access →
          </Link>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {terminalIpoAccess.map((ipo) => (
            <IPOAccessCard
              key={ipo.ticker}
              company={ipo.company}
              ticker={ipo.ticker}
              status={ipo.status}
              allocationStatus={ipo.allocationStatus}
              detail={ipo.offeringPrice ?? ipo.expectedPrice ?? ipo.listingPrice}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Market News"
        className="mt-10"
        action={
          <Link to="/terminal/news" className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline">
            All news →
          </Link>
        }
      >
        <NewsFeed items={terminalNews.slice(0, 4)} />
      </Section>
    </>
  );
}
