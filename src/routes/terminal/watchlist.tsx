import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { TerminalPageShell } from "@/components/terminal/terminal-layout";
import { WatchlistTable } from "@/components/terminal/watchlist-table";
import { EmptyPortfolioState } from "@/components/data/empty-portfolio-state";
import { MockDataNotice } from "@/components/data/mock-data-notice";
import { getWatchlistGroups } from "@/lib/terminal/api";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/terminal/watchlist")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [{ title: "Watchlist — Alta Terminal" }],
  }),
  component: TerminalWatchlist,
});

function TerminalWatchlist() {
  const showMockData = isUserFinancialMockDataEnabled();

  return (
    <TerminalPageShell
      title="Watchlist"
      description={
        showMockData
          ? "Saved companies, price alerts, and watchlist groups — simulated preview data."
          : "Saved companies, price alerts, and watchlist groups."
      }
    >

      <Card className="mb-8 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-[14px] text-muted-foreground">
          Monitor Alta Exchange listed companies across grouped watchlists.
        </p>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md border border-border px-5 py-2.5 text-[13px] font-medium text-muted-foreground"
        >
          Add to Watchlist (unavailable)
        </button>
      </Card>

      {showMockData ? (
        <TerminalWatchlistMockContent />
      ) : (
        <>
          <EmptyPortfolioState
            title="Your watchlist is empty."
            description="Save Alta Exchange listings to track prices and alerts here once terminal access is enabled."
            ctaLabel="Browse Listings"
            ctaTo="/exchange/listings"
          />

          <Section title="Sample watchlist" className="mt-12">
            <MockDataNotice className="mb-4" />
            <WatchlistTable items={getWatchlistGroups()[0].items} />
          </Section>
        </>
      )}
    </TerminalPageShell>
  );
}

function TerminalWatchlistMockContent() {
  const watchlistGroups = getWatchlistGroups();

  return (
    <>
      {watchlistGroups.map((group) => (
        <Section key={group.name} title={group.name} className="mt-10 first:mt-0">
          <WatchlistTable items={group.items} showAlerts={group.name === "Core Positions"} />
        </Section>
      ))}
    </>
  );
}
