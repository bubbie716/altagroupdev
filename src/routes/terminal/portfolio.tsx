import { createFileRoute } from "@tanstack/react-router";
import { TerminalPageShell } from "@/components/terminal/terminal-layout";
import { EmptyPortfolioState } from "@/components/data/empty-portfolio-state";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/terminal/portfolio")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [{ title: "Portfolio — Alta Terminal" }],
  }),
  component: TerminalPortfolio,
});

function TerminalPortfolio() {
  return (
    <TerminalPageShell
      title="Portfolio"
      description="Holdings, allocation, performance, and transaction history."
    >
      <EmptyPortfolioState title="No holdings yet." />
    </TerminalPageShell>
  );
}
