import { Card } from "@/components/page-shell";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { AdminActivityItem } from "@/lib/internal/types";

export function AdminActivityFeed({ items }: { items: AdminActivityItem[] }) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="w-full overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left type-meta">
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Actor</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Target</th>
            <th className="px-4 py-3">Division</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
              <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                {formatActivityDateTime(a.timestamp)}
              </td>
              <td className="px-4 py-3 font-mono text-[12px]">{a.actor}</td>
              <td className="px-4 py-3">{a.action}</td>
              <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground">{a.target}</td>
              <td className="px-4 py-3 font-mono text-[11px]">{a.division}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </Card>
  );
}
