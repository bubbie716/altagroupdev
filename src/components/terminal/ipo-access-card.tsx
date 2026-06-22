import { Card } from "@/components/page-shell";

export function IPOAccessCard({
  company,
  ticker,
  status,
  allocationStatus,
  detail,
}: {
  company: string;
  ticker: string;
  status: string;
  allocationStatus: string;
  detail?: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">{ticker}</div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">{company}</h3>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {status}
        </span>
      </div>
      {detail && <p className="mt-3 text-[13px] text-muted-foreground">{detail}</p>}
      <div className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Allocation: {allocationStatus}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          Indicate Interest
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          View Prospectus
        </button>
      </div>
    </Card>
  );
}
