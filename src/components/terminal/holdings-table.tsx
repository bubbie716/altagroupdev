import { Card } from "@/components/page-shell";
import { MiniChart } from "@/components/mini-chart";
import { florin } from "@/lib/format/money-display";

type Holding = {
  symbol: string;
  shares: number;
  avg: number;
  value: number;
  weight: number;
  name?: string;
  lastPrice?: number;
  change?: number;
};

export function HoldingsTable({ rows }: { rows: Holding[] }) {
  if (rows.length === 0) {
    return (
      <Card className="px-5 py-8 text-center text-[13px] text-muted-foreground">
        No holdings yet.
      </Card>
    );
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="w-full overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left type-meta">
            <th className="px-5 py-3">Symbol</th>
            <th className="px-5 py-3 text-right">Shares</th>
            <th className="px-5 py-3 text-right">Avg Cost</th>
            <th className="px-5 py-3 text-right">Last</th>
            <th className="px-5 py-3 text-right">Value</th>
            <th className="px-5 py-3 text-right">P&L</th>
            <th className="px-5 py-3 text-right">Weight</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => {
            const lastPrice = h.lastPrice ?? h.avg;
            const cost = h.shares * h.avg;
            const p = h.value - cost;
            const positive = (h.change ?? p) >= 0;
            return (
              <tr key={h.symbol} className="border-b border-border/50 last:border-0 transition-colors hover:bg-surface-2/40">
                <td className="px-5 py-3">
                  <span className="font-mono">{h.symbol}</span>
                  <div className="text-[11px] text-muted-foreground">{h.name ?? h.symbol}</div>
                </td>
                <td className="tabular px-5 py-3 text-right">{h.shares.toLocaleString()}</td>
                <td className="tabular px-5 py-3 text-right text-muted-foreground">{h.avg.toFixed(2)}</td>
                <td className="tabular px-5 py-3 text-right">{lastPrice.toFixed(2)}</td>
                <td className="tabular px-5 py-3 text-right">{florin(h.value)}</td>
                <td className={`tabular px-5 py-3 text-right ${p >= 0 ? "ticker-up" : "ticker-down"}`}>
                  {p >= 0 ? "+" : ""}
                  {florin(p)}
                </td>
                <td className="tabular px-5 py-3 text-right text-muted-foreground">
                  {(h.weight * 100).toFixed(1)}%
                </td>
                <td className="w-20 px-5 py-3">
                  <MiniChart data={[{ t: 0, v: lastPrice }, { t: 1, v: lastPrice }]} positive={positive} height={28} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </Card>
  );
}
