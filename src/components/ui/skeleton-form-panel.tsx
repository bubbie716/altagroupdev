import { Skeleton, SkeletonButton, SkeletonHeading, SkeletonRegion } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Compact form/panel skeleton for dialogs and inline client fetches. */
export function SkeletonFormPanel({
  className,
  fields = 3,
  label = "Loading options",
}: {
  className?: string;
  fields?: number;
  label?: string;
}) {
  return (
    <SkeletonRegion className={cn("space-y-4 py-1", className)} label={label}>
      <SkeletonHeading size="sm" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-2.5 w-24 rounded" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      <SkeletonButton className="mt-1" />
    </SkeletonRegion>
  );
}
