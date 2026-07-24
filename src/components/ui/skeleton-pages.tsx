import {
  Skeleton,
  SkeletonAccountCard,
  SkeletonButton,
  SkeletonCard,
  SkeletonChart,
  SkeletonHeading,
  SkeletonLegalDocument,
  SkeletonList,
  SkeletonPageHeader,
  SkeletonRegion,
  SkeletonStatCard,
  SkeletonTable,
  SkeletonText,
  SkeletonTransactionRow,
} from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Bank dashboard — mirrors stat strips, account grid, recent activity. */
export function SkeletonBankDashboard({ className }: { className?: string }) {
  return (
    <SkeletonRegion className={cn("space-y-8", className)} label="Loading banking overview">
      <div className="grid divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1/80 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-4 py-4 sm:px-5">
            <Skeleton className="h-2.5 w-24 rounded" />
            <Skeleton className="mt-3 h-7 w-28 rounded-md" />
          </div>
        ))}
      </div>
      <div className="grid divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-1/80 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-4 py-4 sm:px-5">
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="mt-3 h-6 w-24 rounded-md" />
          </div>
        ))}
      </div>
      <div>
        <SkeletonHeading size="sm" className="mb-4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonAccountCard key={i} />
          ))}
        </div>
      </div>
      <div>
        <SkeletonHeading size="sm" className="mb-4" />
        <div className="overflow-hidden rounded-xl border border-border bg-surface-1/80">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonTransactionRow key={i} />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Account detail overview — stats + info cards + activity. */
export function SkeletonAccountPage({ className }: { className?: string }) {
  return (
    <SkeletonRegion className={cn("space-y-8", className)} label="Loading account">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard>
          <SkeletonHeading size="sm" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between gap-4">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonHeading size="sm" />
          <div className="mt-4 flex flex-wrap gap-2">
            <SkeletonButton />
            <SkeletonButton />
            <SkeletonButton />
          </div>
        </SkeletonCard>
      </div>
      <SkeletonTable rows={6} cols={5} />
    </SkeletonRegion>
  );
}

/** Generic bank content page — header strip + table or cards. */
export function SkeletonBankContentPage({
  className,
  variant = "table",
}: {
  className?: string;
  variant?: "table" | "cards" | "form";
}) {
  return (
    <SkeletonRegion className={cn("space-y-6", className)} label="Loading page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SkeletonHeading size="sm" />
        <SkeletonButton />
      </div>
      {variant === "table" ? (
        <SkeletonTable rows={7} cols={5} />
      ) : variant === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <SkeletonCard className="max-w-xl">
          <SkeletonHeading size="sm" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-2.5 w-20 rounded" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
            <SkeletonButton className="mt-2" />
          </div>
        </SkeletonCard>
      )}
    </SkeletonRegion>
  );
}

/** Internal ops dashboard — queue cards + vitals + activity. */
export function SkeletonInternalDashboard({ className }: { className?: string }) {
  return (
    <SkeletonRegion className={cn("space-y-6", className)} label="Loading operations center">
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="rounded border border-border bg-surface-1/60 px-3 py-2.5"
            aria-hidden
          >
            <Skeleton className="h-2.5 w-28 rounded" />
            <Skeleton className="mt-2 h-6 w-12 rounded-md" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 divide-x divide-border rounded border border-border bg-surface-1/40 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-3 py-2.5" aria-hidden>
            <Skeleton className="h-2 w-16 rounded" />
            <Skeleton className="mt-2 h-5 w-20 rounded-md" />
          </div>
        ))}
      </div>
      <SkeletonTable rows={6} cols={5} denser />
    </SkeletonRegion>
  );
}

/** Internal table-heavy page. */
export function SkeletonInternalTablePage({ className }: { className?: string }) {
  return (
    <SkeletonRegion className={cn("space-y-4", className)} label="Loading table">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SkeletonHeading size="sm" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-40 rounded-md" />
          <SkeletonButton size="sm" />
        </div>
      </div>
      <SkeletonTable rows={8} cols={6} denser />
    </SkeletonRegion>
  );
}

/** Terminal / exchange markets-style dashboard. */
export function SkeletonMarketsDashboard({ className }: { className?: string }) {
  return (
    <SkeletonRegion className={cn("space-y-6", className)} label="Loading markets">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SkeletonChart height={260} />
        <SkeletonCard>
          <SkeletonHeading size="sm" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
      <SkeletonTable rows={6} cols={5} />
    </SkeletonRegion>
  );
}

/** Legacy shortcut routes (/dashboard, /admin). */
export function SkeletonShortcutDashboard({ className }: { className?: string }) {
  return (
    <SkeletonRegion className={cn("space-y-8", className)} label="Loading dashboard">
      <div className="space-y-3 border-b border-border/60 pb-6">
        <Skeleton className="h-2.5 w-28 rounded" />
        <SkeletonHeading size="lg" />
        <SkeletonText lines={2} className="max-w-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="p-5">
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="mt-3 h-7 w-24 rounded-md" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonTable rows={6} cols={3} />
    </SkeletonRegion>
  );
}

/** Corporate / account / companies generic page. */
export function SkeletonCorporatePage({
  className,
  withHeader = true,
}: {
  className?: string;
  withHeader?: boolean;
}) {
  return (
    <SkeletonRegion className={cn("space-y-8", className)} label="Loading page">
      {withHeader ? <SkeletonPageHeader /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <SkeletonChart height={240} />
      <SkeletonList rows={5} withAvatar />
    </SkeletonRegion>
  );
}

/** Profile / companies account surface. */
export function SkeletonAccountSurface({ className }: { className?: string }) {
  return (
    <SkeletonRegion className={cn("space-y-6", className)} label="Loading account">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="space-y-2">
          <SkeletonHeading size="md" />
          <Skeleton className="h-2.5 w-40 rounded" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonTable rows={5} cols={4} />
    </SkeletonRegion>
  );
}

export function SkeletonLegalPage({ className }: { className?: string }) {
  return (
    <SkeletonRegion className={className} label="Loading document">
      <SkeletonLegalDocument />
    </SkeletonRegion>
  );
}

/** Compact fallback when layout is unknown — still structured, not a spinner. */
export function SkeletonGenericPage({ className }: { className?: string }) {
  return (
    <SkeletonRegion className={cn("space-y-6 py-2", className)} label="Loading content">
      <SkeletonHeading size="md" />
      <div className="grid gap-3 sm:grid-cols-3">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      <SkeletonTable rows={5} cols={4} />
    </SkeletonRegion>
  );
}

export {
  SkeletonBankDashboard as SkeletonDashboard,
};
