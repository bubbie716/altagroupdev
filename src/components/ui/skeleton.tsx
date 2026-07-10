import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  /** When true, renders as an inline-block (avatars, badges). */
  inline?: boolean;
};

/** Base skeleton block — uses `.skeleton` shimmer with reduced-motion support. */
export function Skeleton({ className, inline, style, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn("skeleton", inline ? "inline-block" : "block", className)}
      style={style}
      {...props}
    />
  );
}

export function SkeletonText({
  className,
  lines = 1,
  lastLineWidth = "72%",
}: {
  className?: string;
  lines?: number;
  lastLineWidth?: string | number;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3 w-full rounded"
          style={
            i === lines - 1 && lines > 1
              ? ({ width: lastLineWidth } satisfies CSSProperties)
              : undefined
          }
        />
      ))}
    </div>
  );
}

export function SkeletonHeading({
  className,
  size = "lg",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const height =
    size === "sm" ? "h-4" : size === "md" ? "h-5" : size === "xl" ? "h-9 sm:h-10" : "h-7 sm:h-8";
  const width =
    size === "sm" ? "w-28" : size === "md" ? "w-40" : size === "xl" ? "w-64 sm:w-80" : "w-52 sm:w-64";
  return <Skeleton className={cn(height, width, "rounded-md", className)} />;
}

export function SkeletonAvatar({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "size-8" : size === "lg" ? "size-12" : "size-10";
  return <Skeleton className={cn(dim, "shrink-0 rounded-full", className)} />;
}

export function SkeletonButton({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "sm" ? "h-8 w-20" : size === "lg" ? "h-11 w-36" : "h-9 w-28";
  return <Skeleton className={cn(dims, "rounded-md", className)} />;
}

export function SkeletonBadge({ className }: { className?: string }) {
  return <Skeleton className={cn("h-5 w-16 rounded-full", className)} />;
}

export function SkeletonCard({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-1/80 p-5 shadow-card sm:p-6",
        className,
      )}
      aria-hidden
    >
      {children ?? (
        <div className="space-y-4">
          <SkeletonHeading size="sm" />
          <SkeletonText lines={2} />
          <Skeleton className="mt-2 h-8 w-32 rounded-md" />
        </div>
      )}
    </div>
  );
}

export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-1/80 px-4 py-4 sm:px-5",
        className,
      )}
      aria-hidden
    >
      <Skeleton className="h-2.5 w-20 rounded" />
      <Skeleton className="mt-3 h-7 w-28 rounded-md" />
      <Skeleton className="mt-2 h-2.5 w-16 rounded" />
    </div>
  );
}

export function SkeletonPageHeader({
  className,
  withAction = false,
}: {
  className?: string;
  withAction?: boolean;
}) {
  return (
    <div className={cn("border-b border-border/60 pb-6 sm:pb-10", className)} aria-hidden>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-2.5 w-28 rounded" />
          <SkeletonHeading size="xl" />
          <Skeleton className="h-2.5 w-40 rounded" />
          <SkeletonText lines={2} className="max-w-xl" lastLineWidth="55%" />
        </div>
        {withAction ? <SkeletonButton size="lg" className="shrink-0" /> : null}
      </div>
    </div>
  );
}

export function SkeletonList({
  rows = 5,
  className,
  withAvatar = false,
}: {
  rows?: number;
  className?: string;
  withAvatar?: boolean;
}) {
  return (
    <div className={cn("divide-y divide-border/60 rounded-xl border border-border", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          {withAvatar ? <SkeletonAvatar size="sm" /> : null}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-[55%] max-w-[14rem] rounded" />
            <Skeleton className="h-2.5 w-[35%] max-w-[9rem] rounded" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({
  className,
  height = 220,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-surface-1/60 p-4",
        className,
      )}
      style={{ minHeight: height }}
      aria-hidden
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-24 rounded" />
        <div className="flex gap-2">
          <Skeleton className="h-2.5 w-10 rounded" />
          <Skeleton className="h-2.5 w-10 rounded" />
        </div>
      </div>
      <div className="flex h-[calc(100%-2rem)] items-end gap-1.5 sm:gap-2" style={{ minHeight: height - 56 }}>
        {[42, 58, 35, 72, 48, 65, 40, 78, 52, 68, 45, 60].map((h, i) => (
          <Skeleton
            key={i}
            className="min-w-0 flex-1 rounded-t-sm rounded-b-none"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({
  rows = 6,
  cols = 5,
  className,
  showHeader = true,
  denser = false,
}: {
  rows?: number;
  cols?: number;
  className?: string;
  showHeader?: boolean;
  /** Internal ops density (tighter padding). */
  denser?: boolean;
}) {
  const cellPad = denser ? "px-3 py-2.5" : "px-4 py-3 sm:px-5";
  const widths = ["28%", "16%", "14%", "18%", "12%", "14%", "10%", "16%"];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface-1/80",
        denser && "rounded border-border/80 bg-surface-1/30",
        className,
      )}
      aria-hidden
    >
      {showHeader ? (
        <div
          className={cn(
            "flex gap-3 border-b border-border bg-surface-2/40",
            denser ? "px-3 py-2" : "px-4 py-2.5 sm:px-5",
          )}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn("h-2.5 rounded", denser ? "h-2" : "h-2.5")}
              style={{ width: widths[i % widths.length], maxWidth: "8rem" }}
            />
          ))}
        </div>
      ) : null}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className={cn(
            "flex items-center gap-3 border-b border-border/50 last:border-0",
            cellPad,
          )}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn("rounded", denser ? "h-3" : "h-3.5", c === cols - 1 && "hidden sm:block")}
              style={{
                width: widths[c % widths.length],
                maxWidth: c === 0 ? "12rem" : "7rem",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonTransactionRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-0 sm:px-5",
        className,
      )}
      aria-hidden
    >
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-[55%] max-w-[14rem] rounded" />
        <Skeleton className="h-2.5 w-24 rounded" />
      </div>
      <SkeletonBadge className="hidden sm:inline-block" />
      <Skeleton className="h-3.5 w-20 shrink-0 rounded" />
    </div>
  );
}

export function SkeletonAccountCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-1/80 p-5 shadow-card sm:p-6",
        className,
      )}
      aria-hidden
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-20 rounded" />
          <Skeleton className="h-4 w-36 rounded-md" />
        </div>
        <SkeletonBadge />
      </div>
      <Skeleton className="mt-5 h-8 w-40 rounded-md" />
      <Skeleton className="mt-2 h-2.5 w-28 rounded" />
      <div className="mt-5 flex gap-2">
        <SkeletonButton size="sm" />
        <SkeletonButton size="sm" className="w-16" />
      </div>
    </div>
  );
}

export function SkeletonLegalDocument({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-8", className)} aria-hidden>
      <div className="space-y-3 border-b border-border/60 pb-8">
        <Skeleton className="h-2.5 w-24 rounded" />
        <SkeletonHeading size="xl" />
        <SkeletonText lines={2} className="max-w-2xl" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, section) => (
          <div key={section} className="space-y-3">
            <SkeletonHeading size="md" />
            <SkeletonText lines={3} lastLineWidth="68%" />
            <SkeletonText lines={2} lastLineWidth="80%" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Screen-reader announcement for loading regions. */
export function SkeletonRegion({
  className,
  label = "Loading content",
  children,
}: {
  className?: string;
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
