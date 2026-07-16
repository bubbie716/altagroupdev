import { Skeleton, SkeletonHeading, SkeletonStatCard, SkeletonRegion } from "@/components/ui/skeleton";

export function PortalDashboardSkeleton() {
  return (
    <SkeletonRegion className="space-y-6" label="Loading portal dashboard">
      <div className="space-y-2">
        <Skeleton className="h-2.5 w-24 rounded" />
        <SkeletonHeading size="lg" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-sm" />
        <Skeleton className="h-48 rounded-sm" />
      </div>
    </SkeletonRegion>
  );
}

export function PortalTableSkeleton() {
  return (
    <SkeletonRegion className="space-y-4" label="Loading table">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-48 rounded-sm" />
        <Skeleton className="h-9 w-32 rounded-sm" />
      </div>
      <Skeleton className="h-64 w-full rounded-sm" />
    </SkeletonRegion>
  );
}

export function PortalDetailSkeleton() {
  return (
    <SkeletonRegion className="space-y-6" label="Loading settlement detail">
      <SkeletonHeading size="lg" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-sm lg:col-span-2" />
        <Skeleton className="h-40 rounded-sm" />
      </div>
      <Skeleton className="h-56 w-full rounded-sm" />
    </SkeletonRegion>
  );
}
