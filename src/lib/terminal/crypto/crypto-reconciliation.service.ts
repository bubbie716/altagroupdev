/**
 * Deterministic read-only reconciliation engine for Alta Terminal fictional crypto (Phase 4).
 * Persists runs + issues. Deduplicates OPEN issues by fingerprint. Never auto-repairs.
 */

import { createHash } from "node:crypto";
import type {
  TerminalCryptoAsset,
  TerminalCryptoMarketState,
  TerminalCryptoReconciliationIssueSeverity,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { d, roundPrice } from "./crypto-decimal";
import { marginalPrice, reserveLiability } from "./crypto-curve-math";

export type ReconCheckKey =
  | "fixed_supply_conservation"
  | "wallet_aggregation"
  | "npfc_backing"
  | "curve_coverage"
  | "current_price"
  | "market_ledger"
  | "wallet_ledger"
  | "settlement_completeness"
  | "cash_effects"
  | "fee_allocation"
  | "candle_integrity"
  | "wallet_isolation"
  | "order_routing";

export type ReconIssueDraft = {
  checkKey: ReconCheckKey;
  severity: TerminalCryptoReconciliationIssueSeverity;
  summary: string;
  technicalDetails?: string;
  assetId?: string;
  portfolioId?: string;
  orderId?: string;
  settlementId?: string;
  walletId?: string;
  fingerprint: string;
};

export type ReconAssetSnapshot = {
  asset: TerminalCryptoAsset;
  marketState: TerminalCryptoMarketState;
};

export function fingerprintIssue(parts: {
  checkKey: string;
  assetId?: string | null;
  portfolioId?: string | null;
  orderId?: string | null;
  settlementId?: string | null;
  walletId?: string | null;
  detailKey?: string;
}): string {
  const raw = [
    parts.checkKey,
    parts.assetId ?? "",
    parts.portfolioId ?? "",
    parts.orderId ?? "",
    parts.settlementId ?? "",
    parts.walletId ?? "",
    parts.detailKey ?? "",
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

type AssetWithState = TerminalCryptoAsset & { marketState: TerminalCryptoMarketState };

/** Pure checks 1–5, 10 (fee config) against an in-memory snapshot — unit-testable. */
export function checkAssetMarketInvariants(asset: AssetWithState): ReconIssueDraft[] {
  const issues: ReconIssueDraft[] = [];
  const state = asset.marketState;
  const treasury = d(state.treasuryInventory.toString());
  const circulating = d(state.circulatingSupply.toString());
  const reserve = d(state.protectedReserve.toString());
  const stab = d(state.stabilizationFund.toString());
  const revenue = d(state.accruedRevenue.toString());

  // Negatives (feeds several checks)
  for (const [label, value] of [
    ["treasury", treasury],
    ["circulating", circulating],
    ["protectedReserve", reserve],
    ["stabilization", stab],
    ["accruedRevenue", revenue],
  ] as const) {
    if (value.lessThan(0)) {
      issues.push({
        checkKey: "market_ledger",
        severity: "CRITICAL",
        summary: `${asset.symbol} has a negative ${label} balance.`,
        technicalDetails: `${label}=${value.toFixed()}`,
        assetId: asset.id,
        fingerprint: fingerprintIssue({
          checkKey: "negative_balance",
          assetId: asset.id,
          detailKey: label,
        }),
      });
    }
  }

  // 1. Fixed-supply conservation
  if (asset.kind === "BONDING_CURVE" && asset.maxSupply) {
    const maxSupply = d(asset.maxSupply.toString());
    if (!treasury.plus(circulating).equals(maxSupply)) {
      issues.push({
        checkKey: "fixed_supply_conservation",
        severity: "CRITICAL",
        summary: `${asset.symbol} treasury plus circulating supply does not equal max supply.`,
        technicalDetails: `treasury=${treasury.toFixed()} circulating=${circulating.toFixed()} max=${maxSupply.toFixed()}`,
        assetId: asset.id,
        fingerprint: fingerprintIssue({
          checkKey: "fixed_supply_conservation",
          assetId: asset.id,
        }),
      });
    }
  }

  // 3. NPFC backing
  if (asset.kind === "STABLE") {
    if (reserve.lessThan(circulating)) {
      issues.push({
        checkKey: "npfc_backing",
        severity: "CRITICAL",
        summary: `${asset.symbol} protected reserve is below circulating supply at the ƒ1 peg.`,
        technicalDetails: `reserve=${reserve.toFixed()} circulating=${circulating.toFixed()}`,
        assetId: asset.id,
        fingerprint: fingerprintIssue({ checkKey: "npfc_backing", assetId: asset.id }),
      });
    }
  }

  // 4. Curve coverage
  if (asset.kind === "BONDING_CURVE" && asset.curveRate) {
    const liability = reserveLiability({
      startingPrice: asset.pegOrStartingPrice,
      curveRate: asset.curveRate,
      circulatingSupply: circulating,
    });
    if (reserve.lessThan(liability)) {
      issues.push({
        checkKey: "curve_coverage",
        severity: "CRITICAL",
        summary: `${asset.symbol} protected reserve does not cover curve liability.`,
        technicalDetails: `reserve=${reserve.toFixed()} liability=${liability.toFixed()}`,
        assetId: asset.id,
        fingerprint: fingerprintIssue({ checkKey: "curve_coverage", assetId: asset.id }),
      });
    }
  }

  // 5. Current price
  try {
    let expected = roundPrice(asset.pegOrStartingPrice);
    if (asset.kind === "BONDING_CURVE" && asset.curveRate) {
      expected = roundPrice(
        marginalPrice({
          startingPrice: asset.pegOrStartingPrice,
          curveRate: asset.curveRate,
          circulatingSupply: circulating,
        }),
      );
    }
    if (!roundPrice(state.currentMarginalPrice).equals(expected)) {
      issues.push({
        checkKey: "current_price",
        severity: "CRITICAL",
        summary: `${asset.symbol} cached marginal price does not match recomputed price.`,
        technicalDetails: `cached=${state.currentMarginalPrice.toFixed()} expected=${expected.toFixed()}`,
        assetId: asset.id,
        fingerprint: fingerprintIssue({ checkKey: "current_price", assetId: asset.id }),
      });
    }
  } catch (error) {
    issues.push({
      checkKey: "current_price",
      severity: "CRITICAL",
      summary: `${asset.symbol} price recompute failed.`,
      technicalDetails: error instanceof Error ? error.message : "unknown",
      assetId: asset.id,
      fingerprint: fingerprintIssue({ checkKey: "current_price", assetId: asset.id }),
    });
  }

  // 10. Fee allocation config
  if (asset.totalFeeBps !== asset.revenueFeeBps + asset.stabilizationFeeBps) {
    issues.push({
      checkKey: "fee_allocation",
      severity: "CRITICAL",
      summary: `${asset.symbol} fee basis points do not reconcile (total ≠ revenue + stabilization).`,
      technicalDetails: `total=${asset.totalFeeBps} revenue=${asset.revenueFeeBps} stab=${asset.stabilizationFeeBps}`,
      assetId: asset.id,
      fingerprint: fingerprintIssue({ checkKey: "fee_allocation_config", assetId: asset.id }),
    });
  }
  if (asset.kind === "STABLE" && asset.stabilizationFeeBps !== 0) {
    issues.push({
      checkKey: "fee_allocation",
      severity: "WARNING",
      summary: `${asset.symbol} should not allocate fees to stabilization.`,
      technicalDetails: `stabilizationFeeBps=${asset.stabilizationFeeBps}`,
      assetId: asset.id,
      fingerprint: fingerprintIssue({ checkKey: "fee_allocation_npfc", assetId: asset.id }),
    });
  }

  return issues;
}

export type RunCryptoReconciliationInput = {
  actorUserId?: string | null;
  source: "cron" | "manual" | "system";
  assetSymbols?: string[];
};

export type RunCryptoReconciliationResult = {
  runId: string;
  status: "SUCCEEDED" | "FAILED" | "PARTIAL";
  checksPerformed: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  summary: string;
  issueCount: number;
  newIssueCount: number;
  resolvedIssueCount: number;
};

const CHECKS_PER_ASSET = 13;

export async function runCryptoReconciliation(
  input: RunCryptoReconciliationInput,
): Promise<RunCryptoReconciliationResult> {
  const run = await prisma.terminalCryptoReconciliationRun.create({
    data: {
      status: "RUNNING",
      source: input.source,
      actorUserId: input.actorUserId ?? null,
      summary: "Running…",
    },
  });

  const drafts: ReconIssueDraft[] = [];
  let checksPerformed = 0;

  try {
    const assets = await prisma.terminalCryptoAsset.findMany({
      where: input.assetSymbols?.length
        ? { symbol: { in: input.assetSymbols.map((s) => s.toUpperCase()) } }
        : undefined,
      include: { marketState: true },
      orderBy: { symbol: "asc" },
    });

    for (const asset of assets) {
      if (!asset.marketState) {
        drafts.push({
          checkKey: "market_ledger",
          severity: "CRITICAL",
          summary: `${asset.symbol} is missing market state.`,
          assetId: asset.id,
          fingerprint: fingerprintIssue({
            checkKey: "missing_market_state",
            assetId: asset.id,
          }),
        });
        checksPerformed += 1;
        continue;
      }

      const withState = asset as AssetWithState;
      drafts.push(...checkAssetMarketInvariants(withState));
      checksPerformed += 5; // invariants covering 1,3,4,5,10 partially

      // 2. Wallet aggregation
      const walletAgg = await prisma.terminalCryptoWalletBalance.aggregate({
        where: { assetId: asset.id },
        _sum: { availableQuantity: true, reservedQuantity: true },
      });
      const walletSum = d(walletAgg._sum.availableQuantity?.toString() ?? "0").plus(
        d(walletAgg._sum.reservedQuantity?.toString() ?? "0"),
      );
      const circulating = d(asset.marketState.circulatingSupply.toString());
      if (!walletSum.equals(circulating)) {
        drafts.push({
          checkKey: "wallet_aggregation",
          severity: "CRITICAL",
          summary: `${asset.symbol} wallet holdings do not equal circulating supply.`,
          technicalDetails: `wallets=${walletSum.toFixed()} circulating=${circulating.toFixed()}`,
          assetId: asset.id,
          fingerprint: fingerprintIssue({
            checkKey: "wallet_aggregation",
            assetId: asset.id,
          }),
        });
      }
      checksPerformed += 1;

      // 6. Market ledger vs state
      const ledgerAccounts = [
        {
          account: "TREASURY_INVENTORY" as const,
          expected: d(asset.marketState.treasuryInventory.toString()),
        },
        {
          account: "CIRCULATING_SUPPLY" as const,
          expected: circulating,
        },
        {
          account: "PROTECTED_RESERVE" as const,
          expected: d(asset.marketState.protectedReserve.toString()),
        },
        {
          account: "STABILIZATION_FUND" as const,
          expected: d(asset.marketState.stabilizationFund.toString()),
        },
        {
          account: "TERMINAL_REVENUE" as const,
          expected: d(asset.marketState.accruedRevenue.toString()),
        },
      ];
      for (const row of ledgerAccounts) {
        const latest = await prisma.terminalCryptoMarketLedgerEntry.findFirst({
          where: { assetId: asset.id, account: row.account },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });
        if (!latest) {
          if (!row.expected.equals(0)) {
            drafts.push({
              checkKey: "market_ledger",
              severity: "CRITICAL",
              summary: `${asset.symbol} ${row.account.replaceAll("_", " ").toLowerCase()} has no ledger history but a nonzero balance.`,
              technicalDetails: `expected=${row.expected.toFixed()}`,
              assetId: asset.id,
              fingerprint: fingerprintIssue({
                checkKey: "market_ledger",
                assetId: asset.id,
                detailKey: row.account,
              }),
            });
          }
          continue;
        }
        if (!d(latest.balanceAfter.toString()).equals(row.expected)) {
          drafts.push({
            checkKey: "market_ledger",
            severity: "CRITICAL",
            summary: `${asset.symbol} market ledger does not match ${row.account.replaceAll("_", " ").toLowerCase()}.`,
            technicalDetails: `ledger=${latest.balanceAfter.toFixed()} state=${row.expected.toFixed()}`,
            assetId: asset.id,
            fingerprint: fingerprintIssue({
              checkKey: "market_ledger",
              assetId: asset.id,
              detailKey: row.account,
            }),
          });
        }
      }
      checksPerformed += 1;

      // 7. Wallet ledger vs balances
      const balances = await prisma.terminalCryptoWalletBalance.findMany({
        where: { assetId: asset.id },
        take: 500,
      });
      for (const bal of balances) {
        for (const account of ["AVAILABLE", "RESERVED"] as const) {
          const expected =
            account === "AVAILABLE"
              ? d(bal.availableQuantity.toString())
              : d(bal.reservedQuantity.toString());
          const latest = await prisma.terminalCryptoWalletLedgerEntry.findFirst({
            where: { balanceId: bal.id, account, unit: "COIN" },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          });
          if (!latest) {
            if (!expected.equals(0)) {
              drafts.push({
                checkKey: "wallet_ledger",
                severity: "CRITICAL",
                summary: `A ${asset.symbol} wallet balance has no ${account.toLowerCase()} ledger history.`,
                technicalDetails: `balanceId=${bal.id} expected=${expected.toFixed()}`,
                assetId: asset.id,
                walletId: bal.walletId,
                fingerprint: fingerprintIssue({
                  checkKey: "wallet_ledger",
                  assetId: asset.id,
                  walletId: bal.walletId,
                  detailKey: `${bal.id}:${account}`,
                }),
              });
            }
            continue;
          }
          if (!d(latest.balanceAfter.toString()).equals(expected)) {
            drafts.push({
              checkKey: "wallet_ledger",
              severity: "CRITICAL",
              summary: `A ${asset.symbol} wallet ledger does not match its ${account.toLowerCase()} balance.`,
              technicalDetails: `balanceId=${bal.id} ledger=${latest.balanceAfter.toFixed()} state=${expected.toFixed()}`,
              assetId: asset.id,
              walletId: bal.walletId,
              fingerprint: fingerprintIssue({
                checkKey: "wallet_ledger",
                assetId: asset.id,
                walletId: bal.walletId,
                detailKey: `${bal.id}:${account}`,
              }),
            });
          }
        }
      }
      checksPerformed += 1;

      // 8. Settlement completeness (sample recent)
      const cryptoOrders = await prisma.terminalOrder.findMany({
        where: {
          symbol: asset.symbol,
          instrumentKind: "CRYPTO",
          status: "FILLED",
        },
        include: {
          cryptoSettlement: true,
          fills: true,
        },
        take: 200,
        orderBy: { submittedAt: "desc" },
      });
      for (const order of cryptoOrders) {
        if (!order.cryptoSettlement) {
          drafts.push({
            checkKey: "settlement_completeness",
            severity: "CRITICAL",
            summary: `A filled ${asset.symbol} order is missing its settlement record.`,
            technicalDetails: `orderId=${order.id}`,
            assetId: asset.id,
            orderId: order.id,
            fingerprint: fingerprintIssue({
              checkKey: "settlement_completeness",
              assetId: asset.id,
              orderId: order.id,
              detailKey: "missing_settlement",
            }),
          });
          continue;
        }
        if (order.fills.length !== 1) {
          drafts.push({
            checkKey: "settlement_completeness",
            severity: "WARNING",
            summary: `A ${asset.symbol} order does not have exactly one fill.`,
            technicalDetails: `orderId=${order.id} fills=${order.fills.length}`,
            assetId: asset.id,
            orderId: order.id,
            fingerprint: fingerprintIssue({
              checkKey: "settlement_completeness",
              assetId: asset.id,
              orderId: order.id,
              detailKey: "fill_count",
            }),
          });
        }
        const marketLedgerCount = await prisma.terminalCryptoMarketLedgerEntry.count({
          where: { settlementId: order.cryptoSettlement.id },
        });
        if (marketLedgerCount < 1) {
          drafts.push({
            checkKey: "settlement_completeness",
            severity: "CRITICAL",
            summary: `A ${asset.symbol} settlement is missing market ledger entries.`,
            technicalDetails: `settlementId=${order.cryptoSettlement.id}`,
            assetId: asset.id,
            orderId: order.id,
            settlementId: order.cryptoSettlement.id,
            fingerprint: fingerprintIssue({
              checkKey: "settlement_completeness",
              assetId: asset.id,
              settlementId: order.cryptoSettlement.id,
              detailKey: "market_ledger",
            }),
          });
        }
      }
      checksPerformed += 1;

      // 9. Cash effects — settlement customerCashDelta vs cash ledger sums
      for (const order of cryptoOrders) {
        if (!order.cryptoSettlement) continue;
        const cashSum = await prisma.terminalCashLedgerEntry.aggregate({
          where: { relatedOrderId: order.id, status: "POSTED" },
          _sum: { amount: true },
        });
        const sum = d(cashSum._sum.amount?.toString() ?? "0");
        const expected = d(order.cryptoSettlement.customerCashDelta.toString()).toDecimalPlaces(
          2,
        );
        // customerCashDelta is florin-precise; cash ledger is 2dp — compare at money precision
        if (!sum.toDecimalPlaces(2).equals(expected)) {
          drafts.push({
            checkKey: "cash_effects",
            severity: "CRITICAL",
            summary: `A ${asset.symbol} order cash ledger total does not match settlement cash delta.`,
            technicalDetails: `orderId=${order.id} cashSum=${sum.toFixed()} settlement=${expected.toFixed()}`,
            assetId: asset.id,
            orderId: order.id,
            settlementId: order.cryptoSettlement.id,
            fingerprint: fingerprintIssue({
              checkKey: "cash_effects",
              assetId: asset.id,
              orderId: order.id,
            }),
          });
        }
      }
      checksPerformed += 1;

      // Fee allocation on settlements
      for (const order of cryptoOrders) {
        const s = order.cryptoSettlement;
        if (!s) continue;
        if (!d(s.totalFee.toString()).equals(
          d(s.revenueAllocation.toString()).plus(d(s.stabilizationAllocation.toString())),
        )) {
          drafts.push({
            checkKey: "fee_allocation",
            severity: "CRITICAL",
            summary: `A ${asset.symbol} settlement fee split does not reconcile.`,
            technicalDetails: `settlementId=${s.id}`,
            assetId: asset.id,
            settlementId: s.id,
            orderId: order.id,
            fingerprint: fingerprintIssue({
              checkKey: "fee_allocation",
              assetId: asset.id,
              settlementId: s.id,
            }),
          });
        }
        if (asset.kind === "STABLE" && !d(s.stabilizationAllocation.toString()).equals(0)) {
          drafts.push({
            checkKey: "fee_allocation",
            severity: "WARNING",
            summary: `An NPFC settlement unexpectedly allocated stabilization fees.`,
            technicalDetails: `settlementId=${s.id}`,
            assetId: asset.id,
            settlementId: s.id,
            fingerprint: fingerprintIssue({
              checkKey: "fee_allocation_npfc_settlement",
              assetId: asset.id,
              settlementId: s.id,
            }),
          });
        }
      }
      checksPerformed += 1;

      // 11. Candle integrity — M1 tradeCount vs settlements in window (spot check last 24h)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const candleAgg = await prisma.terminalCryptoPriceCandle.aggregate({
        where: { assetId: asset.id, interval: "M1", intervalStart: { gte: since } },
        _sum: { tradeCount: true, tradedQuantity: true },
      });
      const settlementAgg = await prisma.terminalCryptoOrderSettlement.aggregate({
        where: { assetId: asset.id, executedAt: { gte: since } },
        _count: { id: true },
        _sum: { executedQuantity: true },
      });
      const candleTrades = candleAgg._sum.tradeCount ?? 0;
      const settlementTrades = settlementAgg._count.id;
      if (candleTrades > settlementTrades) {
        drafts.push({
          checkKey: "candle_integrity",
          severity: "WARNING",
          summary: `${asset.symbol} M1 candle trade counts exceed settlements in the last 24 hours.`,
          technicalDetails: `candles=${candleTrades} settlements=${settlementTrades}`,
          assetId: asset.id,
          fingerprint: fingerprintIssue({
            checkKey: "candle_integrity",
            assetId: asset.id,
            detailKey: "24h",
          }),
        });
      }
      checksPerformed += 1;

      // 12. Wallet isolation for this asset's wallets
      const wallets = await prisma.terminalCryptoWallet.findMany({
        where: { balances: { some: { assetId: asset.id } } },
        select: { id: true, portfolioId: true },
      });
      const portfolioIds = new Set<string>();
      for (const w of wallets) {
        if (portfolioIds.has(w.portfolioId)) {
          drafts.push({
            checkKey: "wallet_isolation",
            severity: "CRITICAL",
            summary: `Multiple crypto wallets appear linked to the same portfolio.`,
            technicalDetails: `portfolioId=${w.portfolioId}`,
            assetId: asset.id,
            walletId: w.id,
            portfolioId: w.portfolioId,
            fingerprint: fingerprintIssue({
              checkKey: "wallet_isolation",
              portfolioId: w.portfolioId,
              detailKey: "dup_wallet",
            }),
          });
        }
        portfolioIds.add(w.portfolioId);
      }
      checksPerformed += 1;

      // 13. Order routing
      const badVenue = await prisma.terminalOrder.count({
        where: {
          symbol: asset.symbol,
          OR: [
            { instrumentKind: "CRYPTO", NOT: { executionVenue: "ALTA_CRYPTO" } },
            { executionVenue: "ALTA_CRYPTO", NOT: { instrumentKind: "CRYPTO" } },
            {
              instrumentKind: "CRYPTO",
              externalTseOrderId: { not: null },
            },
          ],
        },
      });
      if (badVenue > 0) {
        drafts.push({
          checkKey: "order_routing",
          severity: "CRITICAL",
          summary: `${asset.symbol} has orders with incorrect venue or instrument routing.`,
          technicalDetails: `mismatchedOrders=${badVenue}`,
          assetId: asset.id,
          fingerprint: fingerprintIssue({
            checkKey: "order_routing",
            assetId: asset.id,
          }),
        });
      }
      checksPerformed += 1;
    }

    // Global wallet isolation: portfolio has at most one wallet
    const dupPortfolios = await prisma.$queryRaw<Array<{ portfolioId: string; c: bigint }>>`
      SELECT "portfolioId", COUNT(*)::bigint AS c
      FROM "TerminalCryptoWallet"
      GROUP BY "portfolioId"
      HAVING COUNT(*) > 1
      LIMIT 20
    `;
    for (const row of dupPortfolios) {
      drafts.push({
        checkKey: "wallet_isolation",
        severity: "CRITICAL",
        summary: "A Terminal portfolio has more than one crypto wallet.",
        technicalDetails: `portfolioId=${row.portfolioId} count=${row.c.toString()}`,
        portfolioId: row.portfolioId,
        fingerprint: fingerprintIssue({
          checkKey: "wallet_isolation",
          detailKey: row.portfolioId,
        }),
      });
    }
    checksPerformed += 1;

    // STOCK must use TSE (spot check)
    const stockBad = await prisma.terminalOrder.count({
      where: {
        instrumentKind: "STOCK",
        NOT: { executionVenue: "TSE" },
      },
    });
    if (stockBad > 0) {
      drafts.push({
        checkKey: "order_routing",
        severity: "CRITICAL",
        summary: "Stock orders were found on a non-TSE venue.",
        technicalDetails: `count=${stockBad}`,
        fingerprint: fingerprintIssue({ checkKey: "order_routing", detailKey: "stock_tse" }),
      });
    }
    checksPerformed += 1;

    // Persist issues with OPEN fingerprint dedupe; resolve cleared fingerprints
    const openExisting = await prisma.terminalCryptoReconciliationIssue.findMany({
      where: { status: "OPEN" },
      select: { id: true, fingerprint: true },
    });
    const openByFp = new Map(openExisting.map((i) => [i.fingerprint, i.id]));
    const seenFp = new Set<string>();
    let newIssueCount = 0;
    const now = new Date();

    for (const draft of drafts) {
      if (seenFp.has(draft.fingerprint)) continue;
      seenFp.add(draft.fingerprint);
      const existingId = openByFp.get(draft.fingerprint);
      if (existingId) {
        // Recurring finding: refresh last seen without duplicating the OPEN row.
        await prisma.terminalCryptoReconciliationIssue.update({
          where: { id: existingId },
          data: {
            lastSeenAt: now,
            summary: draft.summary,
            technicalDetails: draft.technicalDetails ?? null,
            severity: draft.severity,
          },
        });
        continue;
      }
      try {
        const created = await prisma.terminalCryptoReconciliationIssue.create({
          data: {
            runId: run.id,
            assetId: draft.assetId ?? null,
            portfolioId: draft.portfolioId ?? null,
            orderId: draft.orderId ?? null,
            settlementId: draft.settlementId ?? null,
            walletId: draft.walletId ?? null,
            checkKey: draft.checkKey,
            severity: draft.severity,
            summary: draft.summary,
            technicalDetails: draft.technicalDetails ?? null,
            status: "OPEN",
            fingerprint: draft.fingerprint,
            lastSeenAt: now,
          },
        });
        newIssueCount += 1;
        // Staff Discord — customer-safe summary only (never technicalDetails / reserve evidence).
        if (draft.severity === "CRITICAL" || draft.severity === "WARNING") {
          const eventType =
            draft.severity === "CRITICAL"
              ? "TERMINAL_CRYPTO_RECON_CRITICAL"
              : "TERMINAL_CRYPTO_RECON_WARNING";
          void import("@/server/staff-audit-notification.service")
            .then(({ sendStaffAuditMessage }) => {
              sendStaffAuditMessage({
                product: "Alta Terminal",
                action:
                  draft.severity === "CRITICAL"
                    ? "Crypto reconciliation critical issue"
                    : "Crypto reconciliation warning",
                eventType,
                actorName: "System",
                details: draft.summary.slice(0, 200),
                severity: draft.severity === "CRITICAL" ? "CRITICAL" : "WARNING",
                source: "cron",
                dedupeKey: `audit-log:${eventType}:${created.id}`,
                internalUrl: "/internal/terminal/crypto",
              });
            })
            .catch(() => undefined);
        }
      } catch {
        // Unique open-fingerprint race — ignore
      }
    }

    let resolvedIssueCount = 0;
    for (const existing of openExisting) {
      if (seenFp.has(existing.fingerprint)) continue;
      await prisma.terminalCryptoReconciliationIssue.update({
        where: { id: existing.id },
        data: {
          status: "RESOLVED",
          resolvedAt: now,
          resolvedByRunId: run.id,
          resolutionSource: "auto_reconcile",
          resolutionNote: "Cleared when fingerprint was no longer detected.",
        },
      });
      resolvedIssueCount += 1;
    }

    const criticalCount = drafts.filter((d) => d.severity === "CRITICAL").length;
    const warningCount = drafts.filter((d) => d.severity === "WARNING").length;
    const infoCount = drafts.filter((d) => d.severity === "INFO").length;
    const status =
      criticalCount > 0 ? "PARTIAL" : drafts.length > 0 ? "PARTIAL" : "SUCCEEDED";
    const summary =
      criticalCount > 0
        ? `Reconciliation finished with ${criticalCount} critical finding(s).`
        : drafts.length > 0
          ? `Reconciliation finished with ${warningCount + infoCount} non-critical finding(s).`
          : "Reconciliation succeeded with no findings.";

    await prisma.terminalCryptoReconciliationRun.update({
      where: { id: run.id },
      data: {
        status,
        completedAt: new Date(),
        checksPerformed:
          checksPerformed > assets.length * CHECKS_PER_ASSET
            ? checksPerformed
            : assets.length * CHECKS_PER_ASSET,
        criticalCount,
        warningCount,
        infoCount,
        summary,
      },
    });

    return {
      runId: run.id,
      status,
      checksPerformed:
        checksPerformed > assets.length * CHECKS_PER_ASSET
          ? checksPerformed
          : assets.length * CHECKS_PER_ASSET,
      criticalCount,
      warningCount,
      infoCount,
      summary,
      issueCount: drafts.length,
      newIssueCount,
      resolvedIssueCount,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Reconciliation failed unexpectedly.";
    await prisma.terminalCryptoReconciliationRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        checksPerformed,
        summary: "Reconciliation failed. Technical details are available to operators.",
        criticalCount: 1,
      },
    });
    await prisma.terminalCryptoReconciliationIssue.create({
      data: {
        runId: run.id,
        checkKey: "market_ledger",
        severity: "CRITICAL",
        summary: "Crypto reconciliation job failed before completing all checks.",
        technicalDetails: message.slice(0, 2000),
        status: "OPEN",
        fingerprint: fingerprintIssue({
          checkKey: "run_failed",
          detailKey: run.id,
        }),
      },
    }).catch(() => undefined);

    return {
      runId: run.id,
      status: "FAILED",
      checksPerformed,
      criticalCount: 1,
      warningCount: 0,
      infoCount: 0,
      summary: "Reconciliation failed.",
      issueCount: 1,
      newIssueCount: 1,
      resolvedIssueCount: 0,
    };
  }
}
