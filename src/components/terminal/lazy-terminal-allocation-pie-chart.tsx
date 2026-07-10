import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const TerminalAllocationPieChart = lazy(
  () => import("@/components/terminal/terminal-allocation-pie-chart"),
);

export function LazyTerminalAllocationPieChart({
  data,
  colors,
  height = 160,
}: {
  data: { name: string; value: number }[];
  colors: string[];
  height?: number;
}) {
  return (
    <div className="h-[160px]" style={{ height }}>
      <Suspense fallback={<Skeleton className="h-full w-full rounded" />}>
        <TerminalAllocationPieChart data={data} colors={colors} />
      </Suspense>
    </div>
  );
}
