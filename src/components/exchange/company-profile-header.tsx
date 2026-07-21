import { florin, pct } from "@/lib/format/money-display";
import type { CompanyProfile } from "@/lib/exchange/types";

export function CompanyProfileHeader({ company }: { company: CompanyProfile }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="type-eyebrow">
            {company.symbol} · {company.exchange}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{company.name}</h2>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {company.sector} · {company.status}
          </div>
        </div>
        <div className="text-right">
          <div className="tabular text-3xl font-semibold tracking-tight">{florin(company.price)}</div>
          <div
            className={`mt-1 font-mono text-[13px] ${company.change >= 0 ? "ticker-up" : "ticker-down"}`}
          >
            {pct(company.change)}
          </div>
        </div>
      </div>
    </div>
  );
}
