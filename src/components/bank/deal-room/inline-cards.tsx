import { Florin } from "@/components/ui/florin";
import { cn } from "@/lib/utils";
import { formatPercent, type ChatPart } from "@/lib/bank/deal-rooms-mock";

const labelCls =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

/** Renders one inline card from a chat message. */
export function InlineCard({ part }: { part: ChatPart }) {
  if (part.type === "term-sheet-card") {
    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-gold/35 bg-gold/[0.05]">
        <div className="flex items-baseline justify-between border-b border-gold/25 px-4 py-2.5">
          <div className="flex items-baseline gap-2">
            <span className={cn(labelCls, "text-gold/90")}>Term sheet</span>
            <span className="font-serif text-[15px] tracking-tight">
              v{part.version}
            </span>
          </div>
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/90 hover:text-gold"
          >
            View →
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-4">
          <CardField label="Amount">
            <Florin value={part.amount} fractionDigits={0} />
          </CardField>
          <CardField label="Rate">
            <span className="tabular font-mono text-[13px]">
              {formatPercent(part.rate)}
            </span>
          </CardField>
          <CardField label="Term">
            <span className="tabular font-mono text-[13px]">
              {part.termMonths} mo
            </span>
          </CardField>
          <CardField label="Min payment">
            <Florin value={part.minPayment} fractionDigits={0} />
          </CardField>
        </dl>
        <div className="flex gap-2 border-t border-gold/25 bg-background/40 px-4 py-2.5">
          <button
            type="button"
            className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-gold hover:bg-gold/20"
          >
            Accept
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            Counter
          </button>
        </div>
      </div>
    );
  }

  if (part.type === "document-request-card") {
    return (
      <div className="mt-3 rounded-lg border border-border bg-surface-1/90 p-4">
        <div className={labelCls}>Documents requested</div>
        <ul className="mt-3 divide-y divide-border/60">
          {part.docs.map((doc) => (
            <li
              key={doc}
              className="flex items-center justify-between gap-3 py-2 text-[13px]"
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-1.5 rounded-full bg-gold"
                  aria-hidden
                />
                {doc}
              </span>
              <button
                type="button"
                className="rounded-md border border-border bg-surface-2/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
              >
                Upload
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (part.type === "status-card") {
    return (
      <div className="mx-auto mt-1 flex max-w-md items-center justify-center gap-3 text-center">
        <span className="h-px flex-1 bg-border" aria-hidden />
        <span className="flex items-center gap-1.5">
          <span className="size-1 rounded-full bg-gold" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {part.label}
          </span>
          {part.detail ? (
            <span className="text-[11px] text-muted-foreground/80">
              · {part.detail}
            </span>
          ) : null}
        </span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
    );
  }

  if (part.type === "signature-card") {
    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-foreground/20 bg-foreground text-background">
        <div className="px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-background/60">
            Ready for signature
          </div>
          <div className="mt-1 font-serif text-[16px] tracking-tight">
            {part.title}
          </div>
          {part.detail ? (
            <p className="mt-1 text-[12px] leading-relaxed text-background/70">
              {part.detail}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-background/15 bg-background/5 px-4 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-background/60">
            Digital signature · UI preview
          </span>
          <button
            type="button"
            className="rounded-md bg-gold px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground hover:bg-gold-soft"
          >
            Sign now
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function CardField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className={labelCls}>{label}</dt>
      <dd className="mt-1 text-[14px]">{children}</dd>
    </div>
  );
}