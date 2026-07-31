/**
 * Deterministic candle rollup: aggregate M1 → M5/M15/H1/H4/D1.
 * Upserts only from real M1 trades; never invents empty volatility candles.
 */

import type { TerminalCryptoCandleInterval } from "@prisma/client";
import { prisma } from "@/server/db";
import { d } from "./crypto-decimal";

const ROLLUP_INTERVALS: Array<{
  interval: Exclude<TerminalCryptoCandleInterval, "M1">;
  minutes: number;
}> = [
  { interval: "M5", minutes: 5 },
  { interval: "M15", minutes: 15 },
  { interval: "H1", minutes: 60 },
  { interval: "H4", minutes: 240 },
  { interval: "D1", minutes: 1440 },
];

export function floorToIntervalStart(at: Date, minutes: number): Date {
  const ms = minutes * 60_000;
  const t = at.getTime();
  // Positive UTC ms — remainder truncation floors to interval start without Math.*.
  return new Date(t - (t % ms));
}

export type CandleRollupResult = {
  assetsProcessed: number;
  candlesUpserted: number;
  ok: boolean;
};

export async function rollupCryptoCandles(opts?: {
  assetIds?: string[];
  /** Lookback window for M1 source candles (default 7 days). */
  lookbackMs?: number;
}): Promise<CandleRollupResult> {
  const lookbackMs = opts?.lookbackMs ?? 7 * 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - lookbackMs);

  const assets = await prisma.terminalCryptoAsset.findMany({
    where: opts?.assetIds?.length ? { id: { in: opts.assetIds } } : undefined,
    select: { id: true },
  });

  let candlesUpserted = 0;

  for (const asset of assets) {
    const m1 = await prisma.terminalCryptoPriceCandle.findMany({
      where: {
        assetId: asset.id,
        interval: "M1",
        intervalStart: { gte: since },
        tradeCount: { gt: 0 },
      },
      orderBy: { intervalStart: "asc" },
    });
    if (m1.length === 0) continue;

    for (const { interval, minutes } of ROLLUP_INTERVALS) {
      type Bucket = {
        intervalStart: Date;
        open: ReturnType<typeof d>;
        high: ReturnType<typeof d>;
        low: ReturnType<typeof d>;
        close: ReturnType<typeof d>;
        tradedQuantity: ReturnType<typeof d>;
        florinVolume: ReturnType<typeof d>;
        tradeCount: number;
      };
      const buckets = new Map<number, Bucket>();

      for (const candle of m1) {
        const start = floorToIntervalStart(candle.intervalStart, minutes);
        const key = start.getTime();
        const existing = buckets.get(key);
        const open = d(candle.open.toString());
        const high = d(candle.high.toString());
        const low = d(candle.low.toString());
        const close = d(candle.close.toString());
        const qty = d(candle.tradedQuantity.toString());
        const vol = d(candle.florinVolume.toString());
        if (!existing) {
          buckets.set(key, {
            intervalStart: start,
            open,
            high,
            low,
            close,
            tradedQuantity: qty,
            florinVolume: vol,
            tradeCount: candle.tradeCount,
          });
        } else {
          existing.high = PrismaDecimalMax(existing.high, high);
          existing.low = PrismaDecimalMin(existing.low, low);
          existing.close = close;
          existing.tradedQuantity = existing.tradedQuantity.plus(qty);
          existing.florinVolume = existing.florinVolume.plus(vol);
          existing.tradeCount += candle.tradeCount;
        }
      }

      for (const bucket of buckets.values()) {
        if (bucket.tradeCount <= 0) continue;
        await prisma.terminalCryptoPriceCandle.upsert({
          where: {
            assetId_interval_intervalStart: {
              assetId: asset.id,
              interval,
              intervalStart: bucket.intervalStart,
            },
          },
          create: {
            assetId: asset.id,
            interval,
            intervalStart: bucket.intervalStart,
            open: bucket.open,
            high: bucket.high,
            low: bucket.low,
            close: bucket.close,
            tradedQuantity: bucket.tradedQuantity,
            florinVolume: bucket.florinVolume,
            tradeCount: bucket.tradeCount,
          },
          update: {
            open: bucket.open,
            high: bucket.high,
            low: bucket.low,
            close: bucket.close,
            tradedQuantity: bucket.tradedQuantity,
            florinVolume: bucket.florinVolume,
            tradeCount: bucket.tradeCount,
          },
        });
        candlesUpserted += 1;
      }
    }
  }

  return {
    assetsProcessed: assets.length,
    candlesUpserted,
    ok: true,
  };
}

function PrismaDecimalMax(a: ReturnType<typeof d>, b: ReturnType<typeof d>) {
  return a.greaterThan(b) ? a : b;
}
function PrismaDecimalMin(a: ReturnType<typeof d>, b: ReturnType<typeof d>) {
  return a.lessThan(b) ? a : b;
}
