import { cn } from "@/lib/utils";

export interface EditorialStat {
  label: string;
  value: string;
}

/**
 * Editorial CTA strip — mono eyebrow, serif headline, body, action row,
 * gold hairline divider, mono stat row. Used as marketing hero on
 * Bank Lending, Business, Products, and Private landing pages.
 */
export function EditorialCtaStrip({
  eyebrow,
  title,
  description,
  actions,
  stats,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  stats?: EditorialStat[];
  className?: string;
}) {
  return (
    <div className={cn("mb-10 overflow-hidden rounded-xl border border-border bg-surface-1/80", className)}>
      <div className="grid gap-6 px-6 py-7 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-10 sm:px-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{eyebrow}</p>
          <h2 className="mt-3 font-serif text-[28px] leading-[1.1] tracking-tight sm:text-[34px]">
            {title}
          </h2>
          {description && (
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
      </div>
      {stats && stats.length > 0 && (
        <>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          <dl
            className={cn(
              "grid grid-cols-2 divide-x divide-border/60",
              stats.length >= 4 ? "sm:grid-cols-4" : stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
            )}
          >
            {stats.map((s) => (
              <div key={s.label} className="px-6 py-4">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {s.label}
                </dt>
                <dd className="mt-1 font-serif text-[20px] tracking-tight tabular">{s.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}