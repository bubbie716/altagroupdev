import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { pct } from "@/lib/mock-data";
import type { RankingEntry } from "@/lib/exchange/types";

export function RankingTable({
  title,
  rows,
  showChange = false,
}: {
  title: string;
  rows: RankingEntry[];
  showChange?: boolean;
}) {
  return (
    <Card className="!p-0">
      <div className="border-b border-border px-5 py-3 type-meta">
        {title}
      </div>
      <div className="overflow-x-auto">
      <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left type-meta">
            <th className="px-5 py-3">#</th>
            <th className="px-5 py-3">Ticker</th>
            <th className="px-5 py-3">Company</th>
            <th className="px-5 py-3 text-right">{showChange ? "Price" : "Value"}</th>
            {showChange && <th className="px-5 py-3 text-right">Change</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticker} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
              <td className="px-5 py-3 font-mono text-muted-foreground">{r.rank}</td>
              <td className="px-5 py-3">
                <Link
                  to="/exchange/company/$ticker"
                  params={{ ticker: r.ticker.toLowerCase() }}
                  className="font-mono hover:text-gold"
                >
                  {r.ticker}
                </Link>
              </td>
              <td className="px-5 py-3">{r.company}</td>
              <td className="tabular px-5 py-3 text-right font-medium">{r.value}</td>
              {showChange && (
                <td
                  className={`tabular px-5 py-3 text-right ${(r.change ?? 0) >= 0 ? "ticker-up" : "ticker-down"}`}
                >
                  {r.change != null ? pct(r.change) : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table></div>
      </div>
    </Card>
  );
}
