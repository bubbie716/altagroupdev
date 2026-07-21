import { createFileRoute } from "@tanstack/react-router";
import { TerminalPageShell } from "@/components/terminal/terminal-layout";
import { EmptyState } from "@/components/data/empty-state";

export const Route = createFileRoute("/terminal/leaderboard")({
  head: () => ({
    meta: [{ title: "Leaderboard — Alta Terminal" }],
  }),
  component: TerminalLeaderboard,
});

function TerminalLeaderboard() {
  return (
    <TerminalPageShell
      title="Investor Leaderboard"
      description="Largest portfolios, daily performance, and activity across Alta Terminal clients."
    >
      <EmptyState
        eyebrow="Alta Terminal"
        title="Leaderboard is not available yet."
        description="Portfolio rankings and activity leaderboards will publish here once Terminal performance services launch."
        className="max-w-xl"
      />
    </TerminalPageShell>
  );
}
