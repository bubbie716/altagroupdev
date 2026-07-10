import { lazy, Suspense } from "react";
import type { PortfolioDashboardStat } from "@/components/account/portfolio-dashboard";
import type { HomePortfolioSnapshot } from "@/lib/account/home-portfolio.types";
import type { AssetAllocationItem } from "@/lib/account/asset-allocation";
import {
  Skeleton,
  SkeletonChart,
  SkeletonHeading,
  SkeletonRegion,
  SkeletonStatCard,
} from "@/components/ui/skeleton";

const PortfolioDashboard = lazy(() =>
  import("@/components/account/portfolio-dashboard").then((mod) => ({
    default: mod.PortfolioDashboard,
  })),
);

function PortfolioPanelSkeleton() {
  return (
    <SkeletonRegion className="space-y-4" label="Loading portfolio">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-24 rounded" />
          <SkeletonHeading size="xl" />
          <Skeleton className="h-2.5 w-40 rounded" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SkeletonStatCard className="min-w-[7rem] !p-3" />
          <SkeletonStatCard className="min-w-[7rem] !p-3" />
          <SkeletonStatCard className="min-w-[7rem] !p-3" />
        </div>
      </div>
      <SkeletonChart height={280} />
    </SkeletonRegion>
  );
}

export type HomePortfolioPanelProps = {
  locked: boolean;
  showUserFinancialMock: boolean;
  snapshot: HomePortfolioSnapshot | null;
  demoNetWorth: number;
  demoAllocation: AssetAllocationItem[];
  indexSeries: { t: number; v: number; at?: number }[];
  buildDemoPortfolioStats: (
    netWorth: number,
    chartData: { t: number; v: number; at?: number }[],
  ) => PortfolioDashboardStat[];
  buildSnapshotPortfolioStats: (snapshot: HomePortfolioSnapshot) => PortfolioDashboardStat[];
  formatSnapshotChangeLabel: (snapshot: HomePortfolioSnapshot) => string;
  assetAllocationFromSnapshot: (snapshot: {
    florinBalance: number;
    portfolioValue: number;
  }) => AssetAllocationItem[];
  florin: (value: number) => string;
};

export function HomePortfolioPanel(props: HomePortfolioPanelProps) {
  const {
    locked,
    showUserFinancialMock,
    snapshot,
    demoNetWorth,
    demoAllocation,
    indexSeries,
    buildDemoPortfolioStats,
    buildSnapshotPortfolioStats,
    formatSnapshotChangeLabel,
    assetAllocationFromSnapshot,
    florin,
  } = props;

  const emptySnapshot: HomePortfolioSnapshot = {
    netWorth: 0,
    florinBalance: 0,
    portfolioValue: 0,
    dailyPnL: 0,
    dailyPnLPercent: 0,
    chartData: [{ t: 0, v: 0 }],
  };

  return (
    <Suspense fallback={<PortfolioPanelSkeleton />}>
      {locked || showUserFinancialMock ? (
        <PortfolioDashboard
          locked={locked}
          signInRedirect="/"
          gradientId="heroFill"
          netWorth="ƒ8,412,209.40"
          changeLabel="+ƒ142,802.10 · +1.72%"
          currentValue={8_412_209.4}
          chartData={indexSeries}
          stats={buildDemoPortfolioStats(demoNetWorth, indexSeries)}
          assetAllocation={demoAllocation}
        />
      ) : (
        <PortfolioDashboard
          signInRedirect="/"
          gradientId="heroFill"
          netWorth={florin(snapshot?.netWorth ?? 0)}
          changeLabel={formatSnapshotChangeLabel(snapshot ?? emptySnapshot)}
          changePositive={(snapshot?.dailyPnL ?? 0) >= 0}
          currentValue={snapshot?.netWorth}
          chartData={snapshot?.chartData ?? [{ t: 0, v: 0 }]}
          stats={buildSnapshotPortfolioStats(snapshot ?? emptySnapshot)}
          assetAllocation={assetAllocationFromSnapshot(
            snapshot ?? { florinBalance: 0, portfolioValue: 0 },
          )}
        />
      )}
    </Suspense>
  );
}
