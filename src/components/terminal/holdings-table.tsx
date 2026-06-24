import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { MiniChart } from "@/components/mini-chart";
import { florin, makeSeries, stocks } from "@/lib/mock-data";

type Holding = {
  symbol: string;
  shares: number;
  avg: number;
  value: number;
  weight: number;
};

export function HoldingsTable({ rows }: { rows: Holding[] }) {
  return (
    <Card className="!p-0">
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
            const s = stocks.find((x) => x.symbol === h.symbol)!;
            const cost = h.shares * h.avg;
            const p = h.value - cost;
            return (
              <tr key={h.symbol} className="border-b border-border/50 last:border-0 transition-colors hover:bg-surface-2/40">
                <td className="px-5 py-3">
                  <Link
                    to="/exchange/company/$ticker"
                    params={{ ticker: h.symbol.toLowerCase() }}
                    className="font-mono hover:text-gold"
                  >
                    {h.symbol}
                  </Link>
                  <div className="text-[11px] text-muted-foreground">{s.name}</div>
                </td>
                <td className="tabular px-5 py-3 text-right">{h.shares.toLocaleString()}</td>
                <td className="tabular px-5 py-3 text-right text-muted-foreground">{h.avg.toFixed(2)}</td>
                <td className="tabular px-5 py-3 text-right">{s.price.toFixed(2)}</td>
                <td className="tabular px-5 py-3 text-right">{florin(h.value)}</td>
                <td className={`tabular px-5 py-3 text-right ${p >= 0 ? "ticker-up" : "ticker-down"}`}>
                  {p >= 0 ? "+" : ""}
                  {florin(p)}
                </td>
                <td className="tabular px-5 py-3 text-right text-muted-foreground">
                  {(h.weight * 100).toFixed(1)}%
                </td>
                <td className="w-20 px-5 py-3">
                  <MiniChart data={makeSeries(30, s.price, 1, 0.05)} positive={s.change >= 0} height={28} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </Card>
  );
}
