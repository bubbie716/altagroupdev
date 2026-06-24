import { Card } from "@/components/page-shell";

type Row = {
  rank: number;
  name: string;
  value: string;
  detail?: string;
  change?: number;
};

export function LeaderboardTable({
  title,
  rows,
  showChange = false,
}: {
  title: string;
  rows: Row[];
  showChange?: boolean;
}) {
  return (
    <Card className="!p-0">
      <div className="border-b border-border px-5 py-3 type-meta">
        {title}
      </div>
      <div className="w-full overflow-x-auto"><table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left type-meta">
            <th className="px-5 py-3">#</th>
            <th className="px-5 py-3">Name</th>
            <th className="px-5 py-3 text-right">{showChange ? "Price" : "Value"}</th>
            {showChange && <th className="px-5 py-3 text-right">Change</th>}
            {!showChange && <th className="px-5 py-3">Detail</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
              <td className="px-5 py-3 font-mono text-muted-foreground">{r.rank}</td>
              <td className="px-5 py-3 font-medium">{r.name}</td>
              <td className="tabular px-5 py-3 text-right">{r.value}</td>
              {showChange && (
                <td
                  className={`tabular px-5 py-3 text-right ${(r.change ?? 0) >= 0 ? "ticker-up" : "ticker-down"}`}
                >
                  {r.change != null ? `${r.change > 0 ? "+" : ""}${r.change.toFixed(2)}%` : "—"}
                </td>
              )}
              {!showChange && <td className="px-5 py-3 text-muted-foreground">{r.detail ?? "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table></div>
    </Card>
  );
}
