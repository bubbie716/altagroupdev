export function OpsTableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded border border-border/80 bg-surface-1/30">
      <div className="border-b border-border/80 bg-surface-2/40 px-3 py-2">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-2 w-16 animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border/40 px-3 py-2.5 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-3 animate-pulse rounded bg-surface-2/80"
              style={{ width: c === 0 ? "30%" : "12%" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
