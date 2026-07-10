import { lazy, Suspense } from "react";
import { SkeletonChart } from "@/components/ui/skeleton";

const BankDashboardTrendChart = lazy(() => import("@/components/bank/bank-dashboard-trend-chart"));

export function LazyBankDashboardTrendChart({ data }: { data: { t: number; v: number }[] }) {
  return (
    <div className="h-48">
      <Suspense fallback={<SkeletonChart height={192} />}>
        <BankDashboardTrendChart data={data} />
      </Suspense>
    </div>
  );
}
