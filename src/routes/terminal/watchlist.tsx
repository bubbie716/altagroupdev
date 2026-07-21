import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { TerminalPageShell } from "@/components/terminal/terminal-layout";
import { EmptyPortfolioState } from "@/components/data/empty-portfolio-state";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/terminal/watchlist")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [{ title: "Watchlist — Alta Terminal" }],
  }),
  component: TerminalWatchlist,
});

function TerminalWatchlist() {
  return (
    <TerminalPageShell
      title="Watchlist"
      description="Saved companies, price alerts, and watchlist groups."
    >
      <Card className="mb-8 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-[14px] text-muted-foreground">
          Track symbols across grouped watchlists once market data is available.
        </p>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md border border-border px-5 py-2.5 text-[13px] font-medium text-muted-foreground"
        >
          Add to Watchlist (unavailable)
        </button>
      </Card>

      <EmptyPortfolioState
        title="Your watchlist is empty."
        description="Saved symbols will appear here once watchlist and market data services are enabled."
        ctaLabel="Back to Terminal"
        ctaTo="/terminal"
      />
    </TerminalPageShell>
  );
}
