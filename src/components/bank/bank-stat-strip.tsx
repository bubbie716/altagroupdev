import { cn } from "@/lib/utils";

export interface BankStatStripItem {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}

/**
 * Institutional stat strip — hairline-divided `dl` with mono uppercase labels
 * and serif tabular values. Replaces card grids of `BankStatCard` on overview
 * surfaces.
 */
export function BankStatStrip({
  items,
  className,
  density = "default",
}: {
  items: BankStatStripItem[];
  className?: string;
  density?: "default" | "compact";
}) {
  const cols =
    items.length >= 4 ? "sm:grid-cols-4" : items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <dl
      className={cn(
        "grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1/80 sm:divide-y-0",
        cols,
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(density === "compact" ? "px-4 py-3" : "px-5 py-4")}
        >
          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {item.label}
          </dt>
          <dd
            className={cn(
              "mt-1 tabular font-serif tracking-tight",
              density === "compact" ? "text-[16px]" : "text-[20px]",
              item.accent && "text-gold",
            )}
          >
            {item.value}
          </dd>
          {item.sub && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
              {item.sub}
            </p>
          )}
        </div>
      ))}
    </dl>
  );
}