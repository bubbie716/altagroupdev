import { lazy, Suspense } from "react";
import { SkeletonChart } from "@/components/ui/skeleton";

const ExchangeMarketSnapshotChart = lazy(
  () => import("@/components/exchange/exchange-market-snapshot-chart"),
);

export function LazyExchangeMarketSnapshotChart({
  data,
  height = 240,
}: {
  data: { t: number; v: number }[];
  height?: number;
}) {
  return (
    <div className="mt-6">
      <LazyExchangeMarketSnapshotChart data={data} />
    </div>
  );
}
