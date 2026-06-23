import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { TerminalSubNav } from "@/components/terminal/terminal-sub-nav";
import { WatchlistTable } from "@/components/terminal/watchlist-table";
import { getWatchlistGroups } from "@/lib/terminal/api";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/terminal/watchlist")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [{ title: "Watchlist — Alta Terminal" }],
  }),
  component: TerminalWatchlist,
});

function TerminalWatchlist() {
  const watchlistGroups = getWatchlistGroups();

  return (
    <PageShell
      eyebrow="Alta Terminal · Watchlist"
      title="Watchlist"
      description="Saved companies, price alerts, and watchlist groups — simulated preview data."
    >
      <TerminalSubNav />

      <Card className="mb-8 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-[14px] text-muted-foreground">
          Monitor Alta Exchange listed companies across grouped watchlists.
        </p>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md border border-border px-5 py-2.5 text-[13px] font-medium text-muted-foreground"
        >
          Add to Watchlist (preview only)
        </button>
      </Card>

      {watchlistGroups.map((group) => (
        <Section key={group.name} title={group.name} className="mt-10 first:mt-0">
          <WatchlistTable items={group.items} showAlerts={group.name === "Core Positions"} />
        </Section>
      ))}
    </PageShell>
  );
}
