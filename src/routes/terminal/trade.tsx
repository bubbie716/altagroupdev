import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { TerminalSubNav } from "@/components/terminal/terminal-sub-nav";
import { TradeTicket } from "@/components/terminal/trade-ticket";
import { getOrders } from "@/lib/terminal/api";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/terminal/trade")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [{ title: "Trade — Alta Terminal" }],
  }),
  component: TerminalTrade,
});

function TerminalTrade() {
  const orders = getOrders();

  return (
    <PageShell
      eyebrow="Alta Terminal · Trade"
      title="Trade Ticket"
      description="Prepare simulated buy and sell orders on Alta Exchange — no execution in this preview."
    >
      <TerminalSubNav />

      <TradeTicket />

      <Section title="Recent Orders" className="mt-10">
        <Card className="!p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
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
          </table>
        </Card>
      </Section>
    </PageShell>
  );
}
