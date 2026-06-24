import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { TerminalPageShell } from "@/components/terminal/terminal-layout";
import { TradeTicket } from "@/components/terminal/trade-ticket";
import { MockDataNotice } from "@/components/data/mock-data-notice";
import { getOrders } from "@/lib/terminal/api";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/terminal/trade")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [{ title: "Trade — Alta Terminal" }],
  }),
  component: TerminalTrade,
});

function TerminalTrade() {
  const showMockData = isUserFinancialMockDataEnabled();

  return (
    <TerminalPageShell
      title="Trade Ticket"
      description={
        showMockData
          ? "Prepare simulated buy and sell orders on Alta Exchange — no execution in this preview."
          : "Prepare buy and sell orders on Alta Exchange."
      }
    >

      <MockDataNotice message="Trading will become available after account and exchange access are enabled." />

      <div className="mt-6">
        <TradeTicket disabled />
      </div>

      {showMockData && <TerminalTradeMockOrders />}
    </TerminalPageShell>
  );
}

function TerminalTradeMockOrders() {
  const orders = getOrders();

  return (
    <Section title="Recent Orders" className="mt-10">
      <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
        <div className="w-full overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left type-meta">
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Side</th>
              <th className="px-5 py-3">Symbol</th>
              <th className="px-5 py-3 text-right">Qty</th>
              <th className="px-5 py-3 text-right">Price</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-border/50 last:border-0">
                <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{o.id}</td>
                <td className={`px-5 py-3 font-mono text-[12px] ${o.side === "BUY" ? "ticker-up" : "ticker-down"}`}>
                  {o.side}
                </td>
                <td className="px-5 py-3 font-mono">{o.symbol}</td>
                <td className="tabular px-5 py-3 text-right">{o.qty}</td>
                <td className="tabular px-5 py-3 text-right">{o.price.toFixed(2)}</td>
                <td className="px-5 py-3 font-mono text-[11px]">{o.status}</td>
                <td className="tabular px-5 py-3 text-right font-mono text-[11px] text-muted-foreground">{o.time}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </Section>
  );
}
