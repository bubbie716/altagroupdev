import { createFileRoute } from "@tanstack/react-router";
import { TerminalPageShell } from "@/components/terminal/terminal-layout";
import { EmptyState } from "@/components/data/empty-state";

export const Route = createFileRoute("/terminal/research")({
  head: () => ({
    meta: [{ title: "Research — Alta Terminal" }],
  }),
  component: TerminalResearch,
});

function TerminalResearch() {
  return (
    <TerminalPageShell
      title="Research"
      description="Company reports, market notes, exchange filings, and economic research."
    >
      <EmptyState
        eyebrow="Alta Terminal"
        title="No research documents yet."
        description="Filings, prospectuses, and research notes will appear here once Alta Exchange document services are available."
        className="max-w-xl"
      />
    </TerminalPageShell>
  );
}
