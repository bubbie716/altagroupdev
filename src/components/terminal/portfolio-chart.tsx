import { lazy, Suspense } from "react";
import { SkeletonChart } from "@/components/ui/skeleton";

const PortfolioChartInner = lazy(() => import("@/components/terminal/portfolio-chart-inner"));

export function PortfolioChart({
  data,
  gradientId = "terminalPortfolio",
  height = 280,
}: {
  data: { t: number; v: number }[];
  gradientId?: string;
  height?: number;
}) {
  return (
    <Suspense fallback={<SkeletonChart height={height} />}>
      <PortfolioChartInner data={data} gradientId={gradientId} height={height} />
    </Suspense>
  );
}
