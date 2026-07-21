import { Card } from "@/components/page-shell";
import { MiniChart } from "@/components/mini-chart";
import { compact, pct } from "@/lib/format/money-display";

type WatchlistItem = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  volume: number;
  marketCap: number;
  alert?: string;
};

export function WatchlistTable({
  items,
  showAlerts = false,
}: {
  items: WatchlistItem[];
  showAlerts?: boolean;
}) {
  if (items.length === 0) {
    return (
      <Card className="px-5 py-8 text-center text-[13px] text-muted-foreground">
        No watchlist symbols yet.
      </Card>
    );
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="w-full overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left type-meta">
            <th className="px-5 py-3">Ticker</th>
            <th className="px-5 py-3">Company</th>
            <th className="px-5 py-3">Sector</th>
            <th className="px-5 py-3 text-right">Last</th>
            <th className="px-5 py-3 text-right">Change</th>
            <th className="px-5 py-3 text-right">Market Cap</th>
            {showAlerts && <th className="px-5 py-3">Alert</th>}
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.symbol} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
              <td className="px-5 py-3 font-mono">{s.symbol}</td>
              <td className="px-5 py-3">{s.name}</td>
              <td className="px-5 py-3 text-muted-foreground">{s.sector}</td>
              <td className="tabular px-5 py-3 text-right">{s.price.toFixed(2)}</td>
              <td className={`tabular px-5 py-3 text-right ${s.change >= 0 ? "ticker-up" : "ticker-down"}`}>
                {pct(s.change)}
              </td>
              <td className="tabular px-5 py-3 text-right text-muted-foreground">ƒ{compact(s.marketCap)}</td>
              {showAlerts && (
                <td className="px-5 py-3 text-[12px] text-muted-foreground">{s.alert ?? "—"}</td>
              )}
              <td className="w-20 px-5 py-3">
                <MiniChart
                  data={[{ t: 0, v: s.price }, { t: 1, v: s.price * (1 + s.change / 100) }]}
                  positive={s.change >= 0}
                  height={28}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </Card>
  );
}
