import { Card } from "@/components/page-shell";
import { MiniChart } from "@/components/mini-chart";
import { pct } from "@/lib/format/money-display";
import type { ExchangeIndex } from "@/lib/exchange/types";

export function IndexCard({ index }: { index: ExchangeIndex }) {
  const hasMarketData = index.series.length > 0;
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
            {index.category}
            {hasMarketData ? ` · ${index.constituents} constituents` : " · constituents unavailable"}
          </div>
        </div>
        {hasMarketData ? (
          <span className={`font-mono text-[12px] ${positive ? "ticker-up" : "ticker-down"}`}>
            {pct(index.change)}
          </span>
        ) : null}
      </div>
      <div className="tabular mt-4 text-2xl font-semibold tracking-tight">
        {hasMarketData
          ? index.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "Unavailable"}
      </div>
      <div className="mt-4 h-14">
        {hasMarketData ? (
          <MiniChart data={index.series} positive={positive} height={56} />
        ) : (
          <div className="flex h-full items-center text-[12px] text-muted-foreground">
            Index values unavailable
          </div>
        )}
      </div>
    </Card>
  );
}
