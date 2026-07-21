import { createFileRoute } from "@tanstack/react-router";
import { TerminalPageShell } from "@/components/terminal/terminal-layout";
import { EmptyState } from "@/components/data/empty-state";

export const Route = createFileRoute("/terminal/ipo")({
  head: () => ({
    meta: [{ title: "IPO Access — Alta Terminal" }],
  }),
  component: TerminalIPO,
});

function TerminalIPO() {
  return (
    <TerminalPageShell
      title="IPO Access"
      description="Track open offerings, upcoming listings, and allocation status when primary market access is available."
    >
      <EmptyState
        eyebrow="Alta Terminal"
        title="IPO access is not available yet."
        description="Open offerings, bookbuilding, and allocation status will appear here once primary market services launch."
        className="max-w-xl"
      />
    </TerminalPageShell>
  );
}
