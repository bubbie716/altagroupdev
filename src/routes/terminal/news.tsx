import { createFileRoute } from "@tanstack/react-router";
import { TerminalPageShell } from "@/components/terminal/terminal-layout";
import { EmptyState } from "@/components/data/empty-state";

export const Route = createFileRoute("/terminal/news")({
  head: () => ({
    meta: [{ title: "Market News — Alta Terminal" }],
  }),
  component: TerminalNews,
});

function TerminalNews() {
  return (
    <TerminalPageShell
      title="Market News"
      description="Market updates, company announcements, exchange notices, and macro headlines."
    >
      <EmptyState
        eyebrow="Alta Terminal"
        title="No market news yet."
        description="Headlines and exchange notices will appear here once Alta Exchange market data services are live."
        className="max-w-xl"
      />
    </TerminalPageShell>
  );
}
