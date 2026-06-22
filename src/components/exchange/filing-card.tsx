import { Card } from "@/components/page-shell";
import type { ResearchDocument } from "@/lib/exchange/types";

export function FilingCard({ doc }: { doc: ResearchDocument }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {doc.category}
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{doc.date}</span>
      </div>
      <h3 className="mt-4 text-[15px] font-medium leading-snug tracking-tight">{doc.title}</h3>
      <p className="mt-2 text-[13px] text-muted-foreground">{doc.issuer}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          View
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          Download
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          Open Filing
        </button>
      </div>
    </Card>
  );
}
