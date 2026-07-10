import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const MiniChartInner = lazy(() => import("@/components/charts/mini-chart-inner"));

export function MiniChart({
  data,
  positive = true,
  height = 56,
}: {
  data: { t: number; v: number }[];
  positive?: boolean;
  height?: number;
}) {
  return (
    <Suspense fallback={<Skeleton className="w-full rounded" style={{ height }} />}>
      <MiniChartInner data={data} positive={positive} height={height} />
    </Suspense>
  );
}
