import { createFileRoute } from "@tanstack/react-router";
import { TerminalPageMeta } from "@/components/terminal/terminal-layout";
import { EmptyPortfolioState } from "@/components/data/empty-portfolio-state";
import { getTerminalDescription } from "@/lib/terminal/api";
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
  const terminalDescription = getTerminalDescription();

  return (
    <>
      <TerminalPageMeta title="Invest Like the 1%" description={terminalDescription} />
      <EmptyPortfolioState
        title="No portfolio connected yet."
        description="Holdings, performance, and market tools will appear here once Alta Terminal portfolio services are connected to your account."
      />
    </>
  );
}
