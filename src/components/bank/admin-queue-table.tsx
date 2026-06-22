import { Card } from "@/components/page-shell";
import { florin } from "@/lib/mock-data";

type AdminRow = {
  id: string;
  primary: string;
  secondary: string;
  amount?: number;
  status: string;
};

export function AdminQueueTable({
  title,
  rows,
  showActions = false,
}: {
  title: string;
  rows: AdminRow[];
  showActions?: boolean;
}) {
  return (
    <Card className="!p-0">
      <div className="border-b border-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-5 py-3">ID</th>
            <th className="px-5 py-3">Client</th>
            <th className="px-5 py-3">Detail</th>
            {rows.some((r) => r.amount != null) && <th className="px-5 py-3 text-right">Amount</th>}
            <th className="px-5 py-3">Status</th>
            {showActions && <th className="px-5 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50 last:border-0">
              <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{r.id}</td>
              <td className="px-5 py-3 font-medium">{r.primary}</td>
              <td className="px-5 py-3 text-muted-foreground">{r.secondary}</td>
              {rows.some((x) => x.amount != null) && (
                <td className="tabular px-5 py-3 text-right">
                  {r.amount != null ? florin(r.amount) : "—"}
                </td>
              )}
              <td className="px-5 py-3 font-mono text-[11px]">{r.status}</td>
              {showActions && (
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded border border-[var(--success)]/30 px-2 py-1 font-mono text-[10px] text-[var(--success)]"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground"
                    >
                      Deny
                    </button>
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground"
                    >
                      Freeze
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
