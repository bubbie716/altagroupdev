/**
 * Atomic Alta Terminal fictional-crypto market-order execution.
 *
 * Lock order (documented):
 *   1. TerminalPortfolio
 *   2. TerminalPortfolioCashAccount
 *   3. TerminalCryptoMarketState (+ asset)
 *   4. TerminalCryptoWallet (if present / created)
 *   5. TerminalCryptoWalletBalance (if present)
 *
 * DB uniqueness on TerminalOrder (portfolioId, clientKey) is the authoritative
 * single-execution guarantee. Outer financial idempotency is an optimization only.
 */
import { Prisma } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { prisma } from "@/server/db";
import {
  quoteBondingCurveBuy,
  quoteBondingCurveSell,
  quoteNpfcPurchase,
  quoteNpfcRedemption,
} from "./crypto-pricing";
import { d, serializeCryptoMoney, serializeCryptoPrice, serializeCryptoQuantity } from "./crypto-decimal";
import { CryptoPricingError } from "./crypto-pricing-types";
import { generateTerminalCryptoPublicWalletId } from "./crypto-wallet-id";
import { assertAssetAllowsSide, assertWalletCanTrade } from "./crypto-lifecycle";
import {
  CryptoOrderError,
  customerMessageForCode,
  type CryptoOrderFillResult,
  type CryptoOrderSubmitInput,
} from "./crypto-order-types";
import { parseCryptoOrderSubmitInput } from "./crypto-order-validation";
import {
  isQuoteExpired,
  stableSha256,
  verifyQuoteFingerprint,
} from "./crypto-quote-token";
import {
  buildPriceImpactWarnings,
  computeRealizedGainLoss,
  computeWeightedAverageCost,
  m1CandleIntervalStart,
} from "./crypto-settlement-math";
import { previewTerminalCryptoOrder } from "./terminal-crypto-preview.service";

type Tx = Prisma.TransactionClient;

function mapPricingError(error: unknown): never {
  if (error instanceof CryptoOrderError) throw error;
  if (error instanceof CryptoPricingError) {
    switch (error.code) {
      case "INSUFFICIENT_TREASURY":
      case "EXCEEDS_MAX_SUPPLY":
        throw new CryptoOrderError("SUPPLY_EXHAUSTED", customerMessageForCode("SUPPLY_EXHAUSTED"));
      case "INSUFFICIENT_WALLET_HOLDINGS":
        throw new CryptoOrderError("INSUFFICIENT_HOLDINGS", customerMessageForCode("INSUFFICIENT_HOLDINGS"));
      case "INSUFFICIENT_PROTECTED_RESERVE":
        throw new CryptoOrderError("RESERVE_INSUFFICIENT", customerMessageForCode("RESERVE_INSUFFICIENT"));
      case "BELOW_MINIMUM_ORDER":
      case "INVALID_INPUT":
        throw new CryptoOrderError("VALIDATION_FAILED", error.message);
      default:
        throw new CryptoOrderError("INTERNAL_FAILURE", customerMessageForCode("INTERNAL_FAILURE"));
    }
  }
  throw new CryptoOrderError("INTERNAL_FAILURE", customerMessageForCode("INTERNAL_FAILURE"));
}

async function lockPortfolio(tx: Tx, portfolioId: string) {
  await tx.$queryRaw`SELECT id FROM "TerminalPortfolio" WHERE id = ${portfolioId} FOR UPDATE`;
}

async function lockCashAccount(tx: Tx, portfolioId: string) {
  await tx.$queryRaw`SELECT id FROM "TerminalPortfolioCashAccount" WHERE "portfolioId" = ${portfolioId} FOR UPDATE`;
}

async function lockMarketState(tx: Tx, assetId: string) {
  await tx.$queryRaw`SELECT id FROM "TerminalCryptoMarketState" WHERE "assetId" = ${assetId} FOR UPDATE`;
}

async function lockWallet(tx: Tx, walletId: string) {
  await tx.$queryRaw`SELECT id FROM "TerminalCryptoWallet" WHERE id = ${walletId} FOR UPDATE`;
}

async function lockWalletBalance(tx: Tx, balanceId: string) {
  await tx.$queryRaw`SELECT id FROM "TerminalCryptoWalletBalance" WHERE id = ${balanceId} FOR UPDATE`;
}

async function ensureCashAccount(tx: Tx, portfolioId: string) {
  const existing = await tx.terminalPortfolioCashAccount.findUnique({ where: { portfolioId } });
  if (existing) return existing;
  return tx.terminalPortfolioCashAccount.create({
    data: { portfolioId, availableCash: 0, reservedCash: 0, currency: "FLORIN", version: 0 },
  });
}

async function createWalletWithRetry(tx: Tx, portfolioId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await tx.terminalCryptoWallet.create({
        data: {
          portfolioId,
          publicWalletId: generateTerminalCryptoPublicWalletId(),
          status: "ACTIVE",
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await tx.terminalCryptoWallet.findUnique({ where: { portfolioId } });
        if (existing) return existing;
        continue; // publicWalletId collision — retry
      }
      throw error;
    }
  }
  throw new CryptoOrderError("INTERNAL_FAILURE", customerMessageForCode("INTERNAL_FAILURE"));
}

function fillResultFromSettlement(input: {
  orderId: string;
  settlement: {
    id: string;
    executedQuantity: Prisma.Decimal;
    grossValue: Prisma.Decimal;
    totalFee: Prisma.Decimal;
    revenueAllocation: Prisma.Decimal;
    stabilizationAllocation: Prisma.Decimal;
    netReserveDelta: Prisma.Decimal;
    priceBefore: Prisma.Decimal;
    priceAfter: Prisma.Decimal;
    averageExecutionPrice: Prisma.Decimal;
    customerCashDelta: Prisma.Decimal;
    realizedGainLoss: Prisma.Decimal | null;
    marketStateVersion: number;
    executedAt: Date;
  };
  symbol: string;
  side: "BUY" | "SELL";
  priceImpactPercent: string;
  resultingTerminalCash: string;
  resultingWalletBalance: string;
  walletPublicId: string;
  replayed: boolean;
}): CryptoOrderFillResult {
  const s = input.settlement;
  return {
    ok: true,
    orderId: input.orderId,
    settlementId: s.id,
    symbol: input.symbol,
    side: input.side,
    executedQuantity: serializeCryptoQuantity(s.executedQuantity),
    grossTradeValue: serializeCryptoMoney(s.grossValue),
    totalFee: serializeCryptoMoney(s.totalFee),
    revenueAllocation: serializeCryptoMoney(s.revenueAllocation),
    stabilizationAllocation: serializeCryptoMoney(s.stabilizationAllocation),
    netReserveDelta: serializeCryptoMoney(s.netReserveDelta),
    priceBefore: serializeCryptoPrice(s.priceBefore)!,
    priceAfter: serializeCryptoPrice(s.priceAfter)!,
    averageExecutionPrice: serializeCryptoPrice(s.averageExecutionPrice)!,
    priceImpactPercent: input.priceImpactPercent,
    customerCashDelta: serializeCryptoMoney(s.customerCashDelta),
    realizedGainLoss: s.realizedGainLoss != null ? serializeCryptoMoney(s.realizedGainLoss) : null,
    resultingTerminalCash: input.resultingTerminalCash,
    resultingWalletBalance: input.resultingWalletBalance,
    walletPublicId: input.walletPublicId,
    marketStateVersion: s.marketStateVersion,
    filledAt: s.executedAt.toISOString(),
    replayed: input.replayed,
  };
}

export async function submitTerminalCryptoOrder(
  user: AltaUser,
  input: CryptoOrderSubmitInput,
): Promise<CryptoOrderFillResult> {
  const parsed = parseCryptoOrderSubmitInput(input);

  const requestHash = stableSha256({
    portfolioId: parsed.portfolioId,
    symbol: parsed.symbol,
    side: parsed.side,
    grossFlorins: parsed.grossFlorins,
    quantity: parsed.quantity,
    clientKey: parsed.clientKey,
  });

  const { beginFinancialIdempotency, IdempotencyConflictError } = await import(
    "@/server/financial-idempotency.service"
  );

  try {
    return await beginFinancialIdempotency({
      userId: user.id,
      scope: "terminal_crypto_order",
      idempotencyKey: `${parsed.portfolioId}:${parsed.clientKey}`,
      payload: {
        portfolioId: parsed.portfolioId,
        symbol: parsed.symbol,
        side: parsed.side,
        grossFlorins: parsed.grossFlorins,
        quantity: parsed.quantity,
        clientKey: parsed.clientKey,
      },
      execute: () => executeTerminalCryptoOrder(user, parsed, requestHash),
    });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      throw new CryptoOrderError("IDEMPOTENCY_CONFLICT", customerMessageForCode("IDEMPOTENCY_CONFLICT"));
    }
    throw error;
  }
}

async function executeTerminalCryptoOrder(
  user: AltaUser,
  parsed: ReturnType<typeof parseCryptoOrderSubmitInput>,
  requestHash: string,
): Promise<CryptoOrderFillResult> {
  const {
    getTerminalPortfolioForUser,
    assertCanTradePortfolio,
  } = await import("@/lib/terminal/terminal-portfolio.service");

  const portfolio = await getTerminalPortfolioForUser(user, parsed.portfolioId);
  if (!portfolio) {
    throw new CryptoOrderError("FORBIDDEN", customerMessageForCode("FORBIDDEN"));
  }
  if (portfolio.status !== "active") {
    throw new CryptoOrderError("PORTFOLIO_ARCHIVED", customerMessageForCode("PORTFOLIO_ARCHIVED"));
  }
  try {
    assertCanTradePortfolio(user, portfolio);
  } catch {
    throw new CryptoOrderError("PORTFOLIO_RESTRICTED", customerMessageForCode("PORTFOLIO_RESTRICTED"));
  }

  if (isQuoteExpired(parsed.quoteExpiresAt)) {
    throw new CryptoOrderError("QUOTE_EXPIRED", customerMessageForCode("QUOTE_EXPIRED"));
  }

  if (
    !verifyQuoteFingerprint(
      {
        portfolioId: parsed.portfolioId,
        symbol: parsed.symbol,
        side: parsed.side,
        grossFlorins: parsed.grossFlorins,
        quantity: parsed.quantity,
        marketStateVersion: parsed.expectedMarketStateVersion,
        quoteExpiresAt: parsed.quoteExpiresAt,
      },
      parsed.quoteFingerprint,
    )
  ) {
    throw new CryptoOrderError("VALIDATION_FAILED", "Quote fingerprint is invalid.");
  }

  if (parsed.symbol !== "NPFC" && parsed.symbol !== "NVA" && parsed.symbol !== "VLT") {
    throw new CryptoOrderError("CRYPTO_UNAVAILABLE", customerMessageForCode("CRYPTO_UNAVAILABLE"));
  }

  let result: CryptoOrderFillResult;

  try {
    result = await prisma.$transaction(async (tx) => {
      await lockPortfolio(tx, portfolio.id);
      await ensureCashAccount(tx, portfolio.id);
      await lockCashAccount(tx, portfolio.id);

      const asset = await tx.terminalCryptoAsset.findUnique({
        where: { symbol: parsed.symbol },
        include: { marketState: true },
      });
      if (!asset?.marketState) {
        throw new CryptoOrderError("CRYPTO_UNAVAILABLE", customerMessageForCode("CRYPTO_UNAVAILABLE"));
      }
      assertAssetAllowsSide(asset.status, parsed.side);
      await lockMarketState(tx, asset.id);

      const marketState = await tx.terminalCryptoMarketState.findUniqueOrThrow({
        where: { assetId: asset.id },
      });

      // Idempotent replay via shared order client key (authoritative).
      const existingOrder = await tx.terminalOrder.findUnique({
        where: {
          portfolioId_clientKey: {
            portfolioId: portfolio.id,
            clientKey: parsed.clientKey,
          },
        },
        include: {
          cryptoSettlement: true,
          cashLedger: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      if (existingOrder?.cryptoSettlement) {
        if (existingOrder.cryptoSettlement.requestHash !== requestHash) {
          throw new CryptoOrderError("IDEMPOTENCY_CONFLICT", customerMessageForCode("IDEMPOTENCY_CONFLICT"));
        }
        const wallet = await tx.terminalCryptoWallet.findUniqueOrThrow({
          where: { id: existingOrder.cryptoSettlement.walletId },
          include: { balances: { where: { assetId: asset.id } } },
        });
        const cash = await tx.terminalPortfolioCashAccount.findUniqueOrThrow({
          where: { portfolioId: portfolio.id },
        });
        const impact = existingOrder.cryptoSettlement.priceBefore.equals(0)
          ? "0"
          : existingOrder.cryptoSettlement.priceAfter
              .minus(existingOrder.cryptoSettlement.priceBefore)
              .div(existingOrder.cryptoSettlement.priceBefore)
              .mul(100)
              .abs()
              .toFixed(8);
        return fillResultFromSettlement({
          orderId: existingOrder.id,
          settlement: existingOrder.cryptoSettlement,
          symbol: asset.symbol,
          side: parsed.side,
          priceImpactPercent: impact,
          resultingTerminalCash: serializeCryptoMoney(cash.availableCash),
          resultingWalletBalance: serializeCryptoQuantity(
            wallet.balances[0]?.availableQuantity?.toString() ?? "0",
          ),
          walletPublicId: wallet.publicWalletId,
          replayed: true,
        });
      }

      if (marketState.version !== parsed.expectedMarketStateVersion) {
        throw new CryptoOrderError(
          "REQUOTE_REQUIRED",
          customerMessageForCode("REQUOTE_REQUIRED"),
          { marketStateVersion: String(marketState.version) },
        );
      }

      let wallet = await tx.terminalCryptoWallet.findUnique({
        where: { portfolioId: portfolio.id },
      });
      if (wallet) {
        await lockWallet(tx, wallet.id);
        wallet = await tx.terminalCryptoWallet.findUniqueOrThrow({ where: { id: wallet.id } });
        assertWalletCanTrade(wallet.status);
      } else if (parsed.side === "SELL") {
        throw new CryptoOrderError("INSUFFICIENT_HOLDINGS", customerMessageForCode("INSUFFICIENT_HOLDINGS"));
      }

      let balance = wallet
        ? await tx.terminalCryptoWalletBalance.findUnique({
            where: { walletId_assetId: { walletId: wallet.id, assetId: asset.id } },
          })
        : null;
      if (balance) await lockWalletBalance(tx, balance.id);

      const cash = await tx.terminalPortfolioCashAccount.findUniqueOrThrow({
        where: { portfolioId: portfolio.id },
      });
      const availableCash = d(cash.availableCash.toString());
      const walletQty = d(balance?.availableQuantity?.toString() ?? "0");

      const marketSnap = {
        symbol: asset.symbol as "NPFC" | "NVA" | "VLT",
        treasuryInventory: marketState.treasuryInventory.toString(),
        circulatingSupply: marketState.circulatingSupply.toString(),
        protectedReserve: marketState.protectedReserve.toString(),
        stabilizationFund: marketState.stabilizationFund.toString(),
        walletAvailable: walletQty.toFixed(8),
      };

      let quote;
      try {
        if (parsed.side === "BUY") {
          if (availableCash.lessThan(d(parsed.grossFlorins!))) {
            throw new CryptoOrderError("INSUFFICIENT_CASH", customerMessageForCode("INSUFFICIENT_CASH"));
          }
          quote =
            asset.kind === "STABLE"
              ? quoteNpfcPurchase({ market: { ...marketSnap, symbol: "NPFC" }, grossFlorins: parsed.grossFlorins! })
              : quoteBondingCurveBuy({
                  market: { ...marketSnap, symbol: asset.symbol as "NVA" | "VLT" },
                  grossFlorins: parsed.grossFlorins!,
                });
        } else {
          quote =
            asset.kind === "STABLE"
              ? quoteNpfcRedemption({
                  market: { ...marketSnap, symbol: "NPFC" },
                  quantity: parsed.quantity!,
                })
              : quoteBondingCurveSell({
                  market: { ...marketSnap, symbol: asset.symbol as "NVA" | "VLT" },
                  quantity: parsed.quantity!,
                });
        }
      } catch (error) {
        mapPricingError(error);
      }

      const impact = quote.priceImpactPercent;
      const { requiresHighImpactConfirmation } = buildPriceImpactWarnings(impact);
      if (requiresHighImpactConfirmation && !parsed.acceptHighPriceImpact) {
        throw new CryptoOrderError(
          "HIGH_PRICE_IMPACT_CONFIRMATION_REQUIRED",
          customerMessageForCode("HIGH_PRICE_IMPACT_CONFIRMATION_REQUIRED"),
          { priceImpactPercent: impact.abs().toFixed(4) },
        );
      }

      const now = new Date();
      const grossTradeValue =
        parsed.side === "BUY"
          ? d(parsed.grossFlorins!)
          : "grossRedemption" in quote
            ? quote.grossRedemption
            : quote.fees.grossValue;

      const customerCashDelta =
        parsed.side === "BUY"
          ? grossTradeValue.neg()
          : "customerPayout" in quote
            ? quote.customerPayout
            : quote.fees.netValue;

      const netReserveDelta =
        parsed.side === "BUY"
          ? "netReserveContribution" in quote
            ? quote.netReserveContribution
            : quote.fees.netValue
          : "netReserveRedemption" in quote
            ? quote.netReserveRedemption.neg()
            : quote.fees.netValue.neg();

      // Lazy wallet on first successful purchase
      let walletJustCreated = false;
      if (!wallet) {
        wallet = await createWalletWithRetry(tx, portfolio.id);
        await lockWallet(tx, wallet.id);
        walletJustCreated = true;
      }

      if (!balance) {
        balance = await tx.terminalCryptoWalletBalance.create({
          data: {
            walletId: wallet.id,
            assetId: asset.id,
            availableQuantity: 0,
            reservedQuantity: 0,
            averageCost: 0,
            realizedGainLoss: 0,
            version: 0,
          },
        });
        await lockWalletBalance(tx, balance.id);
      }

      const prevQty = d(balance.availableQuantity.toString());
      const prevAvg = d(balance.averageCost.toString());
      let nextQty: Prisma.Decimal;
      let nextAvg: Prisma.Decimal;
      let realized: Prisma.Decimal | null = null;
      let nextRealized = d(balance.realizedGainLoss.toString());

      if (parsed.side === "BUY") {
        nextQty = prevQty.plus(quote.executedQuantity);
        nextAvg = computeWeightedAverageCost({
          previousQuantity: prevQty,
          previousAverageCost: prevAvg,
          purchasedQuantity: quote.executedQuantity,
          totalCustomerCost: grossTradeValue,
        });
      } else {
        nextQty = prevQty.minus(quote.executedQuantity);
        if (nextQty.lessThan(0)) {
          throw new CryptoOrderError("INSUFFICIENT_HOLDINGS", customerMessageForCode("INSUFFICIENT_HOLDINGS"));
        }
        const netProceeds =
          "customerPayout" in quote ? quote.customerPayout : quote.fees.netValue;
        realized = computeRealizedGainLoss({
          soldQuantity: quote.executedQuantity,
          averageCost: prevAvg,
          netProceedsAfterFees: netProceeds,
        });
        nextRealized = nextRealized.plus(realized);
        nextAvg = nextQty.equals(0) ? d("0") : prevAvg;
      }

      const nextCash = availableCash.plus(customerCashDelta);
      if (nextCash.lessThan(0)) {
        throw new CryptoOrderError("INSUFFICIENT_CASH", customerMessageForCode("INSUFFICIENT_CASH"));
      }

      // Market state after
      const treasuryAfter =
        "treasuryInventoryAfter" in quote
          ? quote.treasuryInventoryAfter
          : d(marketState.treasuryInventory.toString());
      const circulatingAfter = quote.circulatingSupplyAfter;
      const reserveAfter = quote.protectedReserveAfter;
      const stabAfter = d(marketState.stabilizationFund.toString()).plus(
        quote.fees.stabilizationAllocation,
      );
      const revenueAfter = d(marketState.accruedRevenue.toString()).plus(
        quote.fees.revenueAllocation,
      );

      const order = await tx.terminalOrder.create({
        data: {
          portfolioId: portfolio.id,
          symbol: asset.symbol,
          instrumentKind: "CRYPTO",
          executionVenue: "ALTA_CRYPTO",
          side: parsed.side,
          orderType: "MARKET",
          status: "FILLED",
          quantity: quote.executedQuantity,
          filledQuantity: quote.executedQuantity,
          averageFillPrice: quote.averageExecutionPrice,
          estimatedValue: grossTradeValue.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          clientKey: parsed.clientKey,
          createdByUserId: user.id,
          source: "TERMINAL",
          submittedAt: now,
          completedAt: now,
        },
      });

      await tx.terminalOrderFill.create({
        data: {
          orderId: order.id,
          quantity: quote.executedQuantity,
          price: quote.averageExecutionPrice,
          fee: quote.fees.totalFee.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          idempotencyKey: `crypto-fill:${parsed.clientKey}`,
          executedAt: now,
        },
      });

      const settlement = await tx.terminalCryptoOrderSettlement.create({
        data: {
          orderId: order.id,
          assetId: asset.id,
          walletId: wallet.id,
          priceBefore: quote.priceBefore,
          priceAfter: quote.priceAfter,
          averageExecutionPrice: quote.averageExecutionPrice,
          grossValue: grossTradeValue,
          totalFee: quote.fees.totalFee,
          revenueAllocation: quote.fees.revenueAllocation,
          stabilizationAllocation: quote.fees.stabilizationAllocation,
          netReserveDelta,
          executedQuantity: quote.executedQuantity,
          treasuryInventoryBefore: marketState.treasuryInventory,
          treasuryInventoryAfter: treasuryAfter,
          circulatingSupplyBefore: marketState.circulatingSupply,
          circulatingSupplyAfter: circulatingAfter,
          protectedReserveBefore: marketState.protectedReserve,
          protectedReserveAfter: reserveAfter,
          roundingDust: quote.roundingDust,
          customerCashDelta,
          realizedGainLoss: realized,
          marketStateVersion: marketState.version + 1,
          requestHash,
          quoteFingerprint: parsed.quoteFingerprint,
          idempotencyKey: parsed.clientKey,
          externalReference: order.id,
          executedAt: now,
        },
      });

      // Cash account + ledger (no double-debit): BUY_FILL/SELL_FILL principal + TRADING_FEE
      const feeMoney = quote.fees.totalFee;
      let cashCursor = availableCash;
      if (parsed.side === "BUY") {
        const principal = grossTradeValue.minus(feeMoney);
        cashCursor = cashCursor.minus(feeMoney);
        await tx.terminalCashLedgerEntry.create({
          data: {
            portfolioId: portfolio.id,
            cashAccountId: cash.id,
            amount: feeMoney.neg(),
            availableCashAfter: cashCursor,
            reservedCashAfter: cash.reservedCash,
            kind: "TRADING_FEE",
            status: "POSTED",
            description: `Trading fee for ${asset.symbol} purchase`,
            idempotencyKey: `crypto-fee:${parsed.clientKey}`,
            relatedOrderId: order.id,
            actorUserId: user.id,
            source: "terminal_crypto",
          },
        });
        cashCursor = cashCursor.minus(principal);
        await tx.terminalCashLedgerEntry.create({
          data: {
            portfolioId: portfolio.id,
            cashAccountId: cash.id,
            amount: principal.neg(),
            availableCashAfter: cashCursor,
            reservedCashAfter: cash.reservedCash,
            kind: "BUY_FILL",
            status: "POSTED",
            description: `Bought ${serializeCryptoQuantity(quote.executedQuantity)} ${asset.symbol}`,
            idempotencyKey: `crypto-buy:${parsed.clientKey}`,
            relatedOrderId: order.id,
            actorUserId: user.id,
            source: "terminal_crypto",
          },
        });
      } else {
        const grossCredit = grossTradeValue;
        cashCursor = cashCursor.plus(grossCredit);
        await tx.terminalCashLedgerEntry.create({
          data: {
            portfolioId: portfolio.id,
            cashAccountId: cash.id,
            amount: grossCredit,
            availableCashAfter: cashCursor,
            reservedCashAfter: cash.reservedCash,
            kind: "SELL_FILL",
            status: "POSTED",
            description: `Sold ${serializeCryptoQuantity(quote.executedQuantity)} ${asset.symbol}`,
            idempotencyKey: `crypto-sell:${parsed.clientKey}`,
            relatedOrderId: order.id,
            actorUserId: user.id,
            source: "terminal_crypto",
          },
        });
        cashCursor = cashCursor.minus(feeMoney);
        await tx.terminalCashLedgerEntry.create({
          data: {
            portfolioId: portfolio.id,
            cashAccountId: cash.id,
            amount: feeMoney.neg(),
            availableCashAfter: cashCursor,
            reservedCashAfter: cash.reservedCash,
            kind: "TRADING_FEE",
            status: "POSTED",
            description: `Trading fee for ${asset.symbol} sale`,
            idempotencyKey: `crypto-fee:${parsed.clientKey}`,
            relatedOrderId: order.id,
            actorUserId: user.id,
            source: "terminal_crypto",
          },
        });
      }

      await tx.terminalPortfolioCashAccount.update({
        where: { id: cash.id },
        data: {
          availableCash: nextCash,
          version: { increment: 1 },
        },
      });

      await tx.terminalCryptoWalletBalance.update({
        where: { id: balance.id },
        data: {
          availableQuantity: nextQty,
          averageCost: nextAvg,
          realizedGainLoss: nextRealized,
          version: { increment: 1 },
        },
      });

      await tx.terminalCryptoMarketState.update({
        where: { id: marketState.id },
        data: {
          treasuryInventory: treasuryAfter,
          circulatingSupply: circulatingAfter,
          protectedReserve: reserveAfter,
          stabilizationFund: stabAfter,
          accruedRevenue: revenueAfter,
          currentMarginalPrice: quote.priceAfter,
          version: { increment: 1 },
        },
      });

      const settlementKind = parsed.side === "BUY" ? "BUY_SETTLEMENT" : "SELL_SETTLEMENT";
      const marketEntries: Array<{
        account: "TREASURY_INVENTORY" | "CIRCULATING_SUPPLY" | "PROTECTED_RESERVE" | "STABILIZATION_FUND" | "TERMINAL_REVENUE";
        delta: Prisma.Decimal;
        balanceAfter: Prisma.Decimal;
        kind: "BUY_SETTLEMENT" | "SELL_SETTLEMENT" | "MINT" | "BURN" | "STABILIZATION_ACCRUAL" | "REVENUE_ACCRUAL";
        seq: number;
      }> = [];

      if (asset.kind === "BONDING_CURVE") {
        marketEntries.push({
          account: "TREASURY_INVENTORY",
          delta: treasuryAfter.minus(marketState.treasuryInventory),
          balanceAfter: treasuryAfter,
          kind: settlementKind,
          seq: 1,
        });
      }
      marketEntries.push({
        account: "CIRCULATING_SUPPLY",
        delta: circulatingAfter.minus(marketState.circulatingSupply),
        balanceAfter: circulatingAfter,
        kind: asset.kind === "STABLE" ? (parsed.side === "BUY" ? "MINT" : "BURN") : settlementKind,
        seq: 2,
      });
      marketEntries.push({
        account: "PROTECTED_RESERVE",
        delta: reserveAfter.minus(marketState.protectedReserve),
        balanceAfter: reserveAfter,
        kind: settlementKind,
        seq: 3,
      });
      if (!quote.fees.stabilizationAllocation.equals(0)) {
        marketEntries.push({
          account: "STABILIZATION_FUND",
          delta: quote.fees.stabilizationAllocation,
          balanceAfter: stabAfter,
          kind: "STABILIZATION_ACCRUAL",
          seq: 4,
        });
      }
      if (!quote.fees.revenueAllocation.equals(0)) {
        marketEntries.push({
          account: "TERMINAL_REVENUE",
          delta: quote.fees.revenueAllocation,
          balanceAfter: revenueAfter,
          kind: "REVENUE_ACCRUAL",
          seq: 5,
        });
      }

      for (const entry of marketEntries) {
        await tx.terminalCryptoMarketLedgerEntry.create({
          data: {
            assetId: asset.id,
            settlementId: settlement.id,
            kind: entry.kind,
            account: entry.account,
            delta: entry.delta,
            balanceAfter: entry.balanceAfter,
            entryKey: `settlement:${settlement.id}:${entry.account}:${entry.seq}`,
            actorUserId: user.id,
            source: "terminal_crypto",
          },
        });
      }

      await tx.terminalCryptoWalletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          balanceId: balance.id,
          assetId: asset.id,
          settlementId: settlement.id,
          kind: parsed.side === "BUY" ? "BUY_CREDIT" : "SELL_DEBIT",
          account: "AVAILABLE",
          unit: "COIN",
          delta: parsed.side === "BUY" ? quote.executedQuantity : quote.executedQuantity.neg(),
          balanceAfter: nextQty,
          entryKey: `wallet:${wallet.id}:settlement:${settlement.id}:AVAILABLE`,
          actorUserId: user.id,
          source: "terminal_crypto",
        },
      });

      const activityKind = parsed.side === "BUY" ? "BUY_FILL" : "SELL_FILL";
      const feeMoneyActivity = quote.fees.totalFee.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const principalActivityAmount =
        parsed.side === "BUY"
          ? grossTradeValue.minus(quote.fees.totalFee).neg().toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
          : ("grossRedemption" in quote ? quote.grossRedemption : quote.fees.grossValue)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      if (walletJustCreated) {
        await tx.terminalPortfolioActivity.create({
          data: {
            portfolioId: portfolio.id,
            kind: "ADJUSTMENT",
            occurredAt: now,
            amount: 0,
            symbol: null,
            quantity: null,
            price: null,
            orderId: order.id,
            description: `Wallet assigned · ${wallet.publicWalletId}`,
            cashAfter: nextCash.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          },
        });
      }

      await tx.terminalPortfolioActivity.create({
        data: {
          portfolioId: portfolio.id,
          kind: activityKind,
          occurredAt: now,
          amount: principalActivityAmount,
          symbol: asset.symbol,
          quantity: quote.executedQuantity,
          price: quote.averageExecutionPrice,
          orderId: order.id,
          description:
            parsed.side === "BUY"
              ? `Bought ${serializeCryptoQuantity(quote.executedQuantity)} ${asset.symbol}`
              : `Sold ${serializeCryptoQuantity(quote.executedQuantity)} ${asset.symbol}`,
          cashAfter: nextCash.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
        },
      });

      if (!feeMoneyActivity.equals(0)) {
        await tx.terminalPortfolioActivity.create({
          data: {
            portfolioId: portfolio.id,
            kind: "TRADING_FEE",
            occurredAt: now,
            amount: feeMoneyActivity.neg(),
            symbol: asset.symbol,
            quantity: null,
            price: null,
            orderId: order.id,
            description: `Crypto trading fee · ${asset.symbol}`,
            cashAfter: nextCash.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          },
        });
      }

      if (realized && !realized.equals(0)) {
        await tx.terminalPortfolioActivity.create({
          data: {
            portfolioId: portfolio.id,
            kind: "REALIZED_GAIN_LOSS",
            occurredAt: now,
            amount: realized.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
            symbol: asset.symbol,
            quantity: quote.executedQuantity,
            price: quote.averageExecutionPrice,
            orderId: order.id,
            description: `Realized ${realized.greaterThanOrEqualTo(0) ? "gain" : "loss"} on ${asset.symbol}`,
            cashAfter: nextCash.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
          },
        });
      }

      // M1 candle upsert
      const intervalStart = m1CandleIntervalStart(now);
      const existingCandle = await tx.terminalCryptoPriceCandle.findUnique({
        where: {
          assetId_interval_intervalStart: {
            assetId: asset.id,
            interval: "M1",
            intervalStart,
          },
        },
      });
      const highCandidate = Prisma.Decimal.max(quote.priceBefore, quote.priceAfter);
      const lowCandidate = Prisma.Decimal.min(quote.priceBefore, quote.priceAfter);
      if (!existingCandle) {
        await tx.terminalCryptoPriceCandle.create({
          data: {
            assetId: asset.id,
            interval: "M1",
            intervalStart,
            open: quote.priceBefore,
            high: highCandidate,
            low: lowCandidate,
            close: quote.priceAfter,
            tradedQuantity: quote.executedQuantity,
            florinVolume: grossTradeValue,
            tradeCount: 1,
          },
        });
      } else {
        await tx.terminalCryptoPriceCandle.update({
          where: { id: existingCandle.id },
          data: {
            high: Prisma.Decimal.max(existingCandle.high, highCandidate),
            low: Prisma.Decimal.min(existingCandle.low, lowCandidate),
            close: quote.priceAfter,
            tradedQuantity: existingCandle.tradedQuantity.plus(quote.executedQuantity),
            florinVolume: existingCandle.florinVolume.plus(grossTradeValue),
            tradeCount: { increment: 1 },
          },
        });
      }

      return fillResultFromSettlement({
        orderId: order.id,
        settlement,
        symbol: asset.symbol,
        side: parsed.side,
        priceImpactPercent: impact.abs().toFixed(8),
        resultingTerminalCash: serializeCryptoMoney(nextCash),
        resultingWalletBalance: serializeCryptoQuantity(nextQty),
        walletPublicId: wallet.publicWalletId,
        replayed: false,
      });
    });
  } catch (error) {
    if (error instanceof CryptoOrderError && error.code === "REQUOTE_REQUIRED") {
      try {
        const fresh = await previewTerminalCryptoOrder(user, {
          portfolioId: parsed.portfolioId,
          symbol: parsed.symbol,
          side: parsed.side,
          grossFlorins: parsed.grossFlorins ?? undefined,
          quantity: parsed.quantity ?? undefined,
        });
        throw new CryptoOrderError(
          "REQUOTE_REQUIRED",
          customerMessageForCode("REQUOTE_REQUIRED"),
          error.details,
          fresh,
        );
      } catch (previewError) {
        if (previewError instanceof CryptoOrderError && previewError.code === "REQUOTE_REQUIRED") {
          throw previewError;
        }
        throw error;
      }
    }
    if (error instanceof CryptoOrderError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Concurrent identical clientKey — reload and return
      const existing = await prisma.terminalOrder.findUnique({
        where: {
          portfolioId_clientKey: {
            portfolioId: parsed.portfolioId,
            clientKey: parsed.clientKey,
          },
        },
        include: { cryptoSettlement: true },
      });
      if (existing?.cryptoSettlement) {
        if (existing.cryptoSettlement.requestHash !== requestHash) {
          throw new CryptoOrderError("IDEMPOTENCY_CONFLICT", customerMessageForCode("IDEMPOTENCY_CONFLICT"));
        }
        const wallet = await prisma.terminalCryptoWallet.findUniqueOrThrow({
          where: { id: existing.cryptoSettlement.walletId },
          include: { balances: { where: { asset: { symbol: parsed.symbol } } } },
        });
        const cash = await prisma.terminalPortfolioCashAccount.findUniqueOrThrow({
          where: { portfolioId: parsed.portfolioId },
        });
        return fillResultFromSettlement({
          orderId: existing.id,
          settlement: existing.cryptoSettlement,
          symbol: parsed.symbol,
          side: parsed.side,
          priceImpactPercent: "0",
          resultingTerminalCash: serializeCryptoMoney(cash.availableCash),
          resultingWalletBalance: serializeCryptoQuantity(
            wallet.balances[0]?.availableQuantity?.toString() ?? "0",
          ),
          walletPublicId: wallet.publicWalletId,
          replayed: true,
        });
      }
    }
    mapPricingError(error);
  }

  // Post-commit audit + notification (never roll back settlement)
  try {
    const { writeAuditLog } = await import("@/server/audit.service");
    await writeAuditLog({
      actorUserId: user.id,
      action: "TERMINAL_CRYPTO_ORDER_FILLED",
      entityType: "TERMINAL_CRYPTO_ORDER",
      entityId: result.orderId,
      description: `${result.side === "BUY" ? "Bought" : "Sold"} ${result.executedQuantity} ${result.symbol}`,
      targetUserId: portfolio.ownerUserId ?? user.id,
      targetCompanyId: portfolio.ownerCompanyId ?? undefined,
      metadata: {
        source: "CUSTOMER",
        orderId: result.orderId,
        settlementId: result.settlementId,
        symbol: result.symbol,
        side: result.side,
        grossTradeValue: result.grossTradeValue,
        totalFee: result.totalFee,
      },
    });
  } catch {
    /* ignore */
  }

  try {
    const { scheduleCreateUserNotification } = await import("@/server/notification.service");
    scheduleCreateUserNotification({
      userId: portfolio.ownerUserId ?? user.id,
      type: "TERMINAL_CRYPTO_ORDER_FILLED",
      title: result.side === "BUY" ? "Crypto purchase filled" : "Crypto sale filled",
      body: `${result.side === "BUY" ? "Bought" : "Sold"} ${result.executedQuantity} ${result.symbol} for ƒ${result.grossTradeValue}.`,
      linkUrl: `/terminal/orders?portfolioId=${portfolio.id}`,
      metadata: {
        orderId: result.orderId,
        symbol: result.symbol,
        side: result.side,
      },
    });
  } catch {
    /* ignore */
  }

  return result;
}
