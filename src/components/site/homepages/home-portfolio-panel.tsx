import { lazy, Suspense } from "react";
import type { PortfolioDashboardStat } from "@/components/account/portfolio-dashboard";
import type { HomePortfolioSnapshot } from "@/lib/account/home-portfolio.types";
import type { AssetAllocationItem } from "@/lib/account/asset-allocation";

const PortfolioDashboard = lazy(() =>
  import("@/components/account/portfolio-dashboard").then((mod) => ({
    default: mod.PortfolioDashboard,
  })),
);

function PortfolioPanelSkeleton() {
  return (
    <div
      className="min-h-[320px] animate-pulse rounded-xl bg-surface-2/80"
      aria-hidden
    />
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
