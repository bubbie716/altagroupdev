import { Card } from "@/components/page-shell";

export function ResearchCard({
  title,
  category,
  date,
  issuer,
}: {
  title: string;
  category: string;
  date: string;
  issuer: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {category}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{date}</span>
      </div>
      <h3 className="mt-4 text-[15px] font-medium leading-snug tracking-tight">{title}</h3>
      <p className="mt-2 text-[13px] text-muted-foreground">{issuer}</p>
      <button
        type="button"
        disabled
        className="mt-5 cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
      >
        View
      </button>
    </Card>
  );
}
