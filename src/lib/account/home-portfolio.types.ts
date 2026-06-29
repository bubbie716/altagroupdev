export type HomePortfolioChartPoint = {
  t: number;
  v: number;
  at?: number;
};

export type HomePortfolioSnapshot = {
  netWorth: number;
  florinBalance: number;
  portfolioValue: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  chartData: HomePortfolioChartPoint[];
};
