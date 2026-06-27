import { cn } from "@/lib/utils";

export interface BankStatStripItem {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}

/**
 * Institutional stat strip — hairline-divided cells with mono labels
 * and sans-serif tabular values (matches account cards).
 */
export function BankStatStrip({
  items,
  className,
  density = "default",
}: {
  items: BankStatStripItem[];
  className?: string;
  density?: "default" | "compact" | "emphasized";
}) {
  const cols =
    items.length >= 5
      ? "sm:grid-cols-3 lg:grid-cols-5"
      : items.length >= 4
        ? "sm:grid-cols-4"
        : items.length === 3
          ? "sm:grid-cols-3"
          : "sm:grid-cols-2";
  const rows = items.length === 8 && items.length >= 4 ? "sm:grid-rows-2" : undefined;
  const cellPadding =
    density === "compact" ? "px-4 py-3" : density === "emphasized" ? "px-5 py-5 sm:py-6" : "px-5 py-4";
  const valueSize =
    density === "compact"
      ? "text-xl"
      : density === "emphasized"
        ? "text-2xl"
        : "text-2xl";
  return (
    <dl
      className={cn(
        "grid min-w-0 auto-rows-fr grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1/80 sm:grid-cols-2 sm:divide-x sm:divide-y-0",
        cols,
        rows,
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(cellPadding, "flex h-full min-h-[5.75rem] min-w-0 flex-col justify-center sm:min-h-0")}
        >
          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {item.label}
          </dt>
          <dd
            className={cn(
              "mt-1 min-w-0 truncate tabular font-semibold tracking-tight",
              valueSize,
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