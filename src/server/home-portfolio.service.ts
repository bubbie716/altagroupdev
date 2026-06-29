import type { BankTransactionType as DbBankTransactionType } from "@prisma/client";
import type { HomePortfolioChartPoint, HomePortfolioSnapshot } from "@/lib/account/home-portfolio.types";
import { getSignedBankTransactionAmount } from "@/lib/bank/transaction-display";
import { fromDbBankTransactionType } from "@/server/bank-mapper";
import { prisma } from "@/server/db";

const CHART_HISTORY_DAYS = 365;

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

/** Personal bank balances with zero terminal portfolio until exchange holdings are wired. */
export async function getHomePortfolioSnapshot(userId: string): Promise<HomePortfolioSnapshot> {
  const personalAccounts = await prisma.bankAccount.findMany({
    where: { userId, companyId: null, status: "ACTIVE" },
    select: { id: true, balance: true },
  });

  const portfolioValue = 0;

  if (personalAccounts.length === 0) {
    return {
      netWorth: 0,
      florinBalance: 0,
      portfolioValue,
      dailyPnL: 0,
      dailyPnLPercent: 0,
      chartData: [{ t: 0, v: 0, at: chartDayAnchor(new Date()).getTime() }],
    };
  }

  const accountIds = personalAccounts.map((account) => account.id);
  const florinBalance = personalAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const endDay = chartDayAnchor(new Date());
  const startDay = shiftChartDays(endDay, -CHART_HISTORY_DAYS);

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
  const chartData = buildDailyBalanceSeries(openingBalance, transactions, endDay);

  const todayBalance = chartData[chartData.length - 1]?.v ?? florinBalance;
  const yesterdayBalance = chartData[chartData.length - 2]?.v ?? todayBalance;
  const dailyPnL = todayBalance - yesterdayBalance;
  const dailyPnLPercent = yesterdayBalance !== 0 ? (dailyPnL / yesterdayBalance) * 100 : 0;
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
