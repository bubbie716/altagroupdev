import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { TerminalPageShell } from "@/components/terminal/terminal-layout";
import { LeaderboardTable } from "@/components/terminal/leaderboard-table";
import { getLeaderboard } from "@/lib/terminal/api";

export const Route = createFileRoute("/terminal/leaderboard")({
  head: () => ({
    meta: [{ title: "Leaderboard — Alta Terminal" }],
  }),
  component: TerminalLeaderboard,
});

function TerminalLeaderboard() {
  const lb = getLeaderboard();

  return (
    <TerminalPageShell
      title="Investor Leaderboard"
      description="Largest portfolios, daily performance, and market activity across Alta Exchange Terminal clients — simulated rankings."
    >

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Largest Portfolios">
          <LeaderboardTable
            title="Largest Portfolios"
            rows={lb.largestPortfolios.map((r) => ({ rank: r.rank, name: r.name, value: r.value, detail: r.detail }))}
          />
        </Section>
        <Section title="Best Daily Performance">
          <LeaderboardTable
            title="Best Daily Performance"
            rows={lb.bestDaily.map((r) => ({ rank: r.rank, name: r.name, value: r.value, detail: r.detail }))}
          />
        </Section>
        <Section title="Most Active Investors">
          <LeaderboardTable
            title="Most Active"
            rows={lb.mostActive.map((r) => ({ rank: r.rank, name: r.name, value: r.value, detail: r.detail }))}
          />
        </Section>
        <Section title="Top Private Clients">
          <LeaderboardTable
            title="Top Private Clients"
            rows={lb.topPrivate.map((r) => ({ rank: r.rank, name: r.name, value: r.value, detail: r.detail }))}
          />
        </Section>
        <Section title="Biggest Winners">
          <LeaderboardTable
            title="Winners"
            rows={lb.winners.map((r) => ({ rank: r.rank, name: `${r.ticker} · ${r.name}`, value: r.value, change: r.change }))}
            showChange
          />
        </Section>
        <Section title="Biggest Losers">
          <LeaderboardTable
            title="Losers"
            rows={lb.losers.map((r) => ({ rank: r.rank, name: `${r.ticker} · ${r.name}`, value: r.value, change: r.change }))}
            showChange
          />
        </Section>
      </div>
    </TerminalPageShell>
  );
}
