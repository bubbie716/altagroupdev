import { lazy, Suspense } from "react";
import { SkeletonChart } from "@/components/ui/skeleton";

const ExchangeCompanyPriceChart = lazy(() => import("@/components/exchange/exchange-company-price-chart"));

export function LazyExchangeCompanyPriceChart({
  data,
  gradientId,
}: {
  data: { t: number; v: number }[];
  gradientId?: string;
}) {
  return (
    <div className="h-[280px]">
      <Suspense fallback={<SkeletonChart height={280} />}>
        <ExchangeCompanyPriceChart data={data} gradientId={gradientId} />
      </Suspense>
    </div>
  );
}
