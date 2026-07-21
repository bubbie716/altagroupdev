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
  snapshot: HomePortfolioSnapshot | null;
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
    snapshot,
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

  const activeSnapshot = snapshot ?? emptySnapshot;

  return (
    <Suspense fallback={<PortfolioPanelSkeleton />}>
      <PortfolioDashboard
        locked={locked}
        signInRedirect="/"
        gradientId="heroFill"
        netWorth={locked ? "Sign in to view" : florin(activeSnapshot.netWorth)}
        changeLabel={
          locked
            ? "Portfolio unavailable until you sign in."
            : formatSnapshotChangeLabel(activeSnapshot)
        }
        changePositive={activeSnapshot.dailyPnL >= 0}
        currentValue={locked ? undefined : activeSnapshot.netWorth}
        chartData={locked ? [{ t: 0, v: 0 }] : activeSnapshot.chartData}
        stats={locked ? [] : buildSnapshotPortfolioStats(activeSnapshot)}
        assetAllocation={
          locked
            ? []
            : assetAllocationFromSnapshot({
                florinBalance: activeSnapshot.florinBalance,
                portfolioValue: activeSnapshot.portfolioValue,
              })
        }
      />
    </Suspense>
  );
}
