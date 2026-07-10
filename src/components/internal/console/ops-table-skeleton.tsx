import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function OpsTableSkeleton({
  rows = 5,
  cols = 5,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  const widths = ["28%", "16%", "14%", "18%", "12%", "14%"];

  return (
    <div
      className={cn("overflow-hidden rounded border border-border/80 bg-surface-1/30", className)}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading table</span>
      <div className="border-b border-border/80 bg-surface-2/40 px-3 py-2">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-2 rounded"
              style={{ width: widths[i % widths.length], maxWidth: "6rem" }}
            />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border/40 px-3 py-2.5 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-3 rounded"
              style={{ width: widths[c % widths.length], maxWidth: c === 0 ? "10rem" : "5rem" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
