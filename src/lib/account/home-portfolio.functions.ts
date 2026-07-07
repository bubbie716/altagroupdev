import { createServerFn } from "@tanstack/react-start";
import type { HomePortfolioSnapshot } from "@/lib/account/home-portfolio.types";

export const fetchHomePortfolioSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomePortfolioSnapshot> => {
    const { requireAuth } = await import("@/server/auth.service");
    const { getHomePortfolioSnapshot, HOMEPAGE_CHART_HISTORY_DAYS } = await import(
      "@/server/home-portfolio.service"
    );
    const user = await requireAuth();
    return getHomePortfolioSnapshot(user.id, { historyDays: HOMEPAGE_CHART_HISTORY_DAYS });
  },
);
