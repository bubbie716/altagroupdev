import type { BankTransactionType as DbBankTransactionType } from "@prisma/client";
import type { HomePortfolioChartPoint, HomePortfolioSnapshot } from "@/lib/account/home-portfolio.types";
import { startOfLocalDay } from "@/lib/account/portfolio-chart-series";
import { getSignedBankTransactionAmount } from "@/lib/bank/transaction-display";
import { fromDbBankTransactionType } from "@/server/bank-mapper";
import { prisma } from "@/server/db";

const CHART_HISTORY_DAYS = 365;
const FIVE_MIN_MS = 5 * 60 * 1000;

function chartDayAnchor(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

function shiftChartDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function nyDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function signedTransactionAmount(type: DbBankTransactionType, amount: { toString(): string }): number {
  const code = fromDbBankTransactionType(type);
  return getSignedBankTransactionAmount(code, Number(amount));
}

function floorToFiveMinutes(atMs: number): number {
  return Math.floor(atMs / FIVE_MIN_MS) * FIVE_MIN_MS;
}

function buildDailyBalanceSeries(
  openingBalance: number,
  transactions: { createdAt: Date; type: DbBankTransactionType; amount: { toString(): string } }[],
  endDay: Date,
): HomePortfolioChartPoint[] {
  const startDay = shiftChartDays(endDay, -CHART_HISTORY_DAYS);
  const dailyDelta = new Map<string, number>();

  for (const tx of transactions) {
    const key = nyDayKey(tx.createdAt);
    dailyDelta.set(key, (dailyDelta.get(key) ?? 0) + signedTransactionAmount(tx.type, tx.amount));
  }

  const points: HomePortfolioChartPoint[] = [];
  let balance = openingBalance;

  for (let dayOffset = 0; dayOffset <= CHART_HISTORY_DAYS; dayOffset += 1) {
    const day = shiftChartDays(startDay, dayOffset);
    balance += dailyDelta.get(nyDayKey(day)) ?? 0;
    points.push({ t: dayOffset, v: balance, at: day.getTime() });
  }

  return points;
}

/** Today's balance path from real approved transaction timestamps (5-minute buckets). */
function buildTodayIntradaySeries(
  dayOpenBalance: number,
  transactions: { createdAt: Date; type: DbBankTransactionType; amount: { toString(): string } }[],
  currentBalance: number,
  now: Date,
): HomePortfolioChartPoint[] {
  const dayStart = startOfLocalDay(now).getTime();
  const byBucket = new Map<number, number>();
  byBucket.set(dayStart, dayOpenBalance);

  let running = dayOpenBalance;
  for (const tx of transactions) {
    const at = tx.createdAt.getTime();
    if (at < dayStart) continue;
    running += signedTransactionAmount(tx.type, tx.amount);
    byBucket.set(floorToFiveMinutes(at), running);
  }

  const nowBucket = floorToFiveMinutes(now.getTime());
  byBucket.set(nowBucket, currentBalance);

  return [...byBucket.entries()]
    .sort(([a], [b]) => a - b)
    .map(([at, v], index) => ({ t: index, v, at }));
}

function mergeDailyHistoryWithTodayIntraday(
  dailySeries: HomePortfolioChartPoint[],
  todayIntraday: HomePortfolioChartPoint[],
): HomePortfolioChartPoint[] {
  if (todayIntraday.length === 0) return dailySeries;
  if (dailySeries.length === 0) return todayIntraday;
  return [...dailySeries.slice(0, -1), ...todayIntraday];
}

/** Personal bank balances with zero terminal portfolio until exchange holdings are wired. */
export async function getHomePortfolioSnapshot(userId: string): Promise<HomePortfolioSnapshot> {
  const personalAccounts = await prisma.bankAccount.findMany({
    where: { userId, companyId: null, status: "ACTIVE" },
    select: { id: true, balance: true },
  });

  const portfolioValue = 0;
  const now = new Date();

  if (personalAccounts.length === 0) {
    return {
      netWorth: 0,
      florinBalance: 0,
      portfolioValue,
      dailyPnL: 0,
      dailyPnLPercent: 0,
      chartData: [{ t: 0, v: 0, at: chartDayAnchor(now).getTime() }],
    };
  }

  const accountIds = personalAccounts.map((account) => account.id);
  const florinBalance = personalAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const endDay = chartDayAnchor(now);
  const startDay = shiftChartDays(endDay, -CHART_HISTORY_DAYS);
  const dayStart = startOfLocalDay(now);

  const transactions = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId: { in: accountIds },
      status: "APPROVED",
      createdAt: { gte: startDay },
    },
    select: { createdAt: true, type: true, amount: true },
    orderBy: { createdAt: "asc" },
  });

  const periodNetChange = transactions.reduce(
    (sum, tx) => sum + signedTransactionAmount(tx.type, tx.amount),
    0,
  );
  const openingBalance = florinBalance - periodNetChange;
  const dailySeries = buildDailyBalanceSeries(openingBalance, transactions, endDay);

  const dayOpenBalance = dailySeries.length >= 2 ? dailySeries[dailySeries.length - 2]!.v : openingBalance;
  const todayTransactions = transactions.filter((tx) => tx.createdAt >= dayStart);
  const todayIntraday = buildTodayIntradaySeries(
    dayOpenBalance,
    todayTransactions,
    florinBalance,
    now,
  );
  const chartData = mergeDailyHistoryWithTodayIntraday(dailySeries, todayIntraday);

  const dailyPnL =
    todayIntraday.length >= 2
      ? todayIntraday[todayIntraday.length - 1]!.v - todayIntraday[0]!.v
      : (dailySeries[dailySeries.length - 1]?.v ?? florinBalance) -
        (dailySeries[dailySeries.length - 2]?.v ?? florinBalance);
  const dailyPnLBasis = todayIntraday[0]?.v ?? dailySeries[dailySeries.length - 2]?.v ?? florinBalance;
  const dailyPnLPercent = dailyPnLBasis !== 0 ? (dailyPnL / dailyPnLBasis) * 100 : 0;
  const netWorth = florinBalance + portfolioValue;

  return {
    netWorth,
    florinBalance,
    portfolioValue,
    dailyPnL,
    dailyPnLPercent,
    chartData,
  };
}
