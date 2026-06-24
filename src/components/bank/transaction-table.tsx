import { Card } from "@/components/page-shell";
import { florin } from "@/lib/mock-data";
import { formatActivityDateTime } from "@/lib/format-datetime";

type Row = {
  id: string;
  date: string;
  desc: string;
  category: string;
  amount: number;
};

export function TransactionTable({ rows, title = "Recent Activity" }: { rows: Row[]; title?: string }) {
  return (
    <Card className="!p-0">
      {title && (
        <div className="border-b border-border px-5 py-3 type-meta">
          {title}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left type-meta">
            <th className="px-5 py-3">Date & time</th>
            <th className="px-5 py-3">Reference</th>
            <th className="px-5 py-3">Description</th>
            <th className="px-5 py-3">Category</th>
            <th className="px-5 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr
              key={t.id}
              className="border-b border-border/50 last:border-0 transition-colors hover:bg-surface-2/40"
            >
              <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">
                {formatActivityDateTime(t.date)}
              </td>
              <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{t.id}</td>
              <td className="px-5 py-3">{t.desc}</td>
              <td className="px-5 py-3 text-muted-foreground">{t.category}</td>
              <td
                className={`tabular px-5 py-3 text-right font-medium ${t.amount >= 0 ? "ticker-up" : "ticker-down"}`}
              >
                {t.amount >= 0 ? "+" : ""}
                {florin(t.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
