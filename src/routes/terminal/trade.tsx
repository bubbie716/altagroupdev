import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Section } from "@/components/page-shell";
import { TerminalPageShell } from "@/components/terminal/terminal-layout";
import { TradeTicket } from "@/components/terminal/trade-ticket";
import { EmptyState } from "@/components/data/empty-state";
import { authBeforeLoad } from "@/lib/auth/guards";

type TradeSearch = {
  tab?: "orders";
};

export const Route = createFileRoute("/terminal/trade")({
  beforeLoad: authBeforeLoad,
  validateSearch: (search: Record<string, unknown>): TradeSearch => ({
    tab: search.tab === "orders" ? "orders" : undefined,
  }),
  head: () => ({
    meta: [{ title: "Trade — Alta Terminal" }],
  }),
  component: TerminalTrade,
});

function TerminalTrade() {
  const { tab } = Route.useSearch();
  const ordersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab !== "orders") return;
    ordersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [tab]);

  return (
    <TerminalPageShell
      title="Trade Ticket"
      description="Prepare buy and sell orders when brokerage trading is available."
    >
      <EmptyState
        eyebrow="Alta Terminal"
        title="Trading is not available yet."
        description="Order entry and execution will open after brokerage trading services are enabled for your account."
        className="max-w-xl"
      />

      <div className="mt-6">
        <TradeTicket disabled />
      </div>

      <div ref={ordersRef} className="scroll-mt-24">
        <Section title="Recent Orders" className="mt-10">
          <EmptyState
            compact
            title="No orders yet."
            description="Order history will appear here once trading is available."
            className="max-w-xl"
          />
        </Section>
      </div>
    </TerminalPageShell>
  );
}
