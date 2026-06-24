import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import {
  getTerminalActivitySummary,
  getTerminalOpenOrders,
  getTerminalTopViewed,
  getTerminalWatchlistTrends,
} from "@/lib/internal/api";
import type { TerminalOrderRow } from "@/lib/internal/types";

export const Route = createFileRoute("/internal/terminal")({
  head: () => ({ meta: [{ title: "Terminal Activity — Alta Internal" }] }),
  component: InternalTerminal,
});

function InternalTerminal() {
  const s = getTerminalActivitySummary();
  const orders = getTerminalOpenOrders();
  const topViewed = getTerminalTopViewed();
  const watchlist = getTerminalWatchlistTrends();

  return (
    <InternalPageShell title="Terminal Activity" description="Simulated order flow, research usage, and watchlist trends.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InternalStatCard label="Active Users (24h)" value={String(s.activeUsers24h)} />
        <InternalStatCard label="Open Orders" value={String(s.openOrders)} />
        <InternalStatCard label="Research Views (24h)" value={s.researchViews24h.toLocaleString()} />
        <InternalStatCard label="Watchlist Adds (24h)" value={String(s.watchlistAdds24h)} />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Section title="Most Viewed Companies">
          <Card className="!p-0">
            <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left type-meta">
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3 text-right">Views</th>
                </tr>
              </thead>
              <tbody>
                {topViewed.map((r) => (
                  <tr key={r.symbol} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 font-mono">{r.symbol}</td>
                    <td className="tabular px-4 py-3 text-right font-mono">{r.views}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
        </Section>

        <Section title="Watchlist Trends">
          <Card className="!p-0">
            <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left type-meta">
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Adds</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((r) => (
                  <tr key={r.symbol} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 font-mono">{r.symbol}</td>
                    <td className="tabular px-4 py-3 font-mono">{r.adds}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.label}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
        </Section>
      </div>

      <Section title="Open Mock Orders" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "id", header: "Order", cell: (o: TerminalOrderRow) => <span className="font-mono text-[11px]">{o.id}</span> },
            { key: "user", header: "User", cell: (o: TerminalOrderRow) => o.user },
            { key: "symbol", header: "Symbol", cell: (o: TerminalOrderRow) => <span className="font-mono">{o.symbol}</span> },
            { key: "side", header: "Side", cell: (o: TerminalOrderRow) => <span className={o.side === "BUY" ? "ticker-up font-mono" : "ticker-down font-mono"}>{o.side}</span> },
            { key: "qty", header: "Qty", cell: (o: TerminalOrderRow) => <span className="tabular">{o.qty}</span> },
            { key: "status", header: "Status", cell: (o: TerminalOrderRow) => <StatusBadge status={o.status} /> },
            { key: "time", header: "Time", cell: (o: TerminalOrderRow) => <span className="font-mono text-[11px] text-muted-foreground">{o.time}</span> },
          ]}
          rows={orders}
          rowKey={(o) => o.id}
        />
      </Section>
    </InternalPageShell>
  );
}
