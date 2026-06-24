import { Card } from "@/components/page-shell";
import { MiniChart } from "@/components/mini-chart";
import { pct } from "@/lib/mock-data";
import type { ExchangeIndex } from "@/lib/exchange/types";

export function IndexCard({ index }: { index: ExchangeIndex }) {
  const positive = index.change >= 0;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {index.symbol}
          </div>
          <div className="mt-1 text-[13px]">{index.name}</div>
          <div className="mt-2 type-meta">
            {index.category} · {index.constituents} constituents
          </div>
        </div>
        <span className={`font-mono text-[12px] ${positive ? "ticker-up" : "ticker-down"}`}>
          {pct(index.change)}
        </span>
      </div>
      <div className="tabular mt-4 text-2xl font-semibold tracking-tight">
        {index.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className="mt-4 h-14">
        <MiniChart data={index.series} positive={positive} height={56} />
      </div>
    </Card>
  );
}
