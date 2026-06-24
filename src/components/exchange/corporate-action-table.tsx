import { Card } from "@/components/page-shell";
import type { CorporateAction } from "@/lib/exchange/types";

export function CorporateActionTable({ actions }: { actions: CorporateAction[] }) {
  return (
    <Card className="!p-0">
      <div className="overflow-x-auto">
      <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left type-meta">
            <th className="px-5 py-3">Ticker</th>
            <th className="px-5 py-3">Company</th>
            <th className="px-5 py-3">Action</th>
            <th className="px-5 py-3">Detail</th>
            <th className="px-5 py-3">Date</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={`${a.ticker}-${a.type}-${a.date}`} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
              <td className="px-5 py-3 font-mono">{a.ticker}</td>
              <td className="px-5 py-3">{a.company}</td>
              <td className="px-5 py-3">{a.type}</td>
              <td className="px-5 py-3 text-muted-foreground">{a.detail}</td>
              <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{a.date}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      </div>
    </Card>
  );
}
