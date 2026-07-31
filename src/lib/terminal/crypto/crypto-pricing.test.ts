import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import {
  CRYPTO_ASSET_CONFIGS,
  NVA_CURVE_RATE,
  VLT_CURVE_RATE,
  deriveBondingCurveRate,
  curveRateSeedString,
} from "./crypto-constants";
import { d, roundDownMoney, roundDownQuantity } from "./crypto-decimal";
import {
  marginalPrice,
  netFromSellQuantity,
  quantityFromNetBuy,
  reserveLiability,
} from "./crypto-curve-math";
import {
  calculateFeeBreakdown,
  launchMarketSnapshot,
  quoteBondingCurveBuy,
  quoteBondingCurveSell,
  quoteNpfcPurchase,
  quoteNpfcRedemption,
} from "./crypto-pricing";
import { CryptoPricingError } from "./crypto-pricing-types";
import { generateTerminalCryptoPublicWalletId, isTerminalCryptoPublicWalletId } from "./crypto-wallet-id";
import { getTerminalCryptoLaunchSeedDocuments } from "./crypto-assets.seed";

const Decimal = Prisma.Decimal;

function approxEqual(actual: Prisma.Decimal, expected: Prisma.Decimal | string, tolerance: string) {
  const diff = actual.minus(d(expected)).abs();
  assert.ok(
    diff.lessThanOrEqualTo(d(tolerance)),
    `expected ${actual.toFixed()} ≈ ${d(expected).toFixed()} (tol ${tolerance}), diff=${diff.toFixed()}`,
  );
}

describe("bonding-curve calibration constants", () => {
  it("derives NVA k so a ƒ100 gross launch buy moves price by ~0.25%", () => {
    const k = deriveBondingCurveRate({ startingPrice: "5", targetImpactPercent: "0.25" });
    assert.equal(k.toFixed(18), NVA_CURVE_RATE.toFixed(18));
    const buy = quoteBondingCurveBuy({
      market: launchMarketSnapshot("NVA"),
      grossFlorins: "100",
    });
    approxEqual(buy.priceBefore, "5", "0.000000000001");
    approxEqual(buy.priceImpactPercent, "0.25", "0.0001");
    approxEqual(buy.priceAfter, "5.0125", "0.0001");
  });

  it("derives VLT k so a ƒ100 gross launch buy moves price by ~2.5%", () => {
    const k = deriveBondingCurveRate({ startingPrice: "0.1", targetImpactPercent: "2.5" });
    assert.equal(k.toFixed(18), VLT_CURVE_RATE.toFixed(18));
    const buy = quoteBondingCurveBuy({
      market: launchMarketSnapshot("VLT"),
      grossFlorins: "100",
    });
    approxEqual(buy.priceBefore, "0.1", "0.000000000001");
    approxEqual(buy.priceImpactPercent, "2.5", "0.001");
    approxEqual(buy.priceAfter, "0.1025", "0.0001");
  });

  it("documents seed strings at 18 decimal places", () => {
    assert.equal(curveRateSeedString(NVA_CURVE_RATE), "0.000632102272727273");
    assert.equal(curveRateSeedString(VLT_CURVE_RATE), "0.000002556818181818");
  });
});

describe("NPFC peg quotes", () => {
  it("always mints/redeems against exact ƒ1.00 peg", () => {
    const purchase = quoteNpfcPurchase({
      market: launchMarketSnapshot("NPFC"),
      grossFlorins: "100",
    });
    assert.equal(purchase.pegPrice.toFixed(12), "1.000000000000");
    assert.equal(purchase.priceBefore.toFixed(12), "1.000000000000");
    assert.equal(purchase.priceAfter.toFixed(12), "1.000000000000");
    assert.equal(purchase.priceImpactPercent.toFixed(), "0");
    // ƒ100 gross, 0.10% fee → ƒ99.90 net → 99.9 NPFC
    approxEqual(purchase.executedQuantity, "99.9", "0.00000001");
    approxEqual(purchase.fees.totalFee, "0.1", "0.00000001");

    const redeem = quoteNpfcRedemption({
      market: {
        symbol: "NPFC",
        treasuryInventory: "0",
        circulatingSupply: purchase.circulatingSupplyAfter.toFixed(8),
        protectedReserve: purchase.protectedReserveAfter.toFixed(12),
        walletAvailable: purchase.executedQuantity.toFixed(8),
      },
      quantity: purchase.executedQuantity.toFixed(8),
    });
    assert.equal(redeem.pegPrice.toFixed(12), "1.000000000000");
    assert.ok(redeem.customerPayout.lessThan(purchase.fees.grossValue));
    assert.ok(redeem.invariants.reserveSolvent);
  });

  it("cannot redeem beyond protected reserve", () => {
    assert.throws(
      () =>
        quoteNpfcRedemption({
          market: {
            symbol: "NPFC",
            treasuryInventory: "0",
            circulatingSupply: "50",
            protectedReserve: "10",
            walletAvailable: "50",
          },
          quantity: "50",
        }),
      (err: unknown) => err instanceof CryptoPricingError && err.code === "INSUFFICIENT_PROTECTED_RESERVE",
    );
  });
});

describe("bonding-curve buy/sell mechanics", () => {
  it("prices rise monotonically on buys and fall on sells", () => {
    let market = launchMarketSnapshot("NVA");
    let lastPrice = d("5");
    for (const gross of ["10", "25", "50", "100"]) {
      const buy = quoteBondingCurveBuy({ market, grossFlorins: gross });
      assert.ok(buy.priceAfter.greaterThanOrEqualTo(buy.priceBefore));
      assert.ok(buy.priceAfter.greaterThanOrEqualTo(lastPrice));
      lastPrice = buy.priceAfter;
      market = {
        symbol: "NVA",
        treasuryInventory: buy.treasuryInventoryAfter.toFixed(8),
        circulatingSupply: buy.circulatingSupplyAfter.toFixed(8),
        protectedReserve: buy.protectedReserveAfter.toFixed(12),
        stabilizationFund: "0",
        walletAvailable: buy.executedQuantity.toFixed(8),
      };
    }
    const sell = quoteBondingCurveSell({
      market: { ...market, walletAvailable: market.circulatingSupply },
      quantity: "1",
    });
    assert.ok(sell.priceAfter.lessThanOrEqualTo(sell.priceBefore));
  });

  it("buy then equivalent sell is reversible on the curve before fees/rounding", () => {
    const buy = quoteBondingCurveBuy({
      market: launchMarketSnapshot("NVA"),
      grossFlorins: "100",
    });
    // Ideal quantity before floor — prove integral inverse identity on unrounded path
    const idealQty = quantityFromNetBuy({
      startingPrice: "5",
      curveRate: NVA_CURVE_RATE,
      circulatingSupply: "0",
      netFlorins: "99",
    });
    const back = netFromSellQuantity({
      startingPrice: "5",
      curveRate: NVA_CURVE_RATE,
      circulatingSupply: idealQty,
      quantity: idealQty,
    });
    approxEqual(back, "99", "0.000000000001");

    // Customer cannot profit from immediate round trip after fees + rounding
    const sell = quoteBondingCurveSell({
      market: {
        symbol: "NVA",
        treasuryInventory: buy.treasuryInventoryAfter.toFixed(8),
        circulatingSupply: buy.circulatingSupplyAfter.toFixed(8),
        protectedReserve: buy.protectedReserveAfter.toFixed(12),
        walletAvailable: buy.executedQuantity.toFixed(8),
      },
      quantity: buy.executedQuantity.toFixed(8),
    });
    assert.ok(sell.customerPayout.lessThan(d("100")));
    assert.ok(sell.customerPayout.lessThan(buy.fees.grossValue.minus(buy.fees.totalFee)));
  });

  it("reserve never drops below calculated curve liability", () => {
    const buy = quoteBondingCurveBuy({
      market: launchMarketSnapshot("VLT"),
      grossFlorins: "250",
    });
    assert.ok(buy.protectedReserveAfter.greaterThanOrEqualTo(buy.reserveLiabilityAfter));
    const sellQty = roundDownQuantity(buy.executedQuantity.div(2));
    const sell = quoteBondingCurveSell({
      market: {
        symbol: "VLT",
        treasuryInventory: buy.treasuryInventoryAfter.toFixed(8),
        circulatingSupply: buy.circulatingSupplyAfter.toFixed(8),
        protectedReserve: buy.protectedReserveAfter.toFixed(12),
        walletAvailable: buy.executedQuantity.toFixed(8),
      },
      quantity: sellQty.toFixed(8),
    });
    assert.ok(sell.protectedReserveAfter.greaterThanOrEqualTo(sell.reserveLiabilityAfter));
  });

  it("circulating + treasury equals fixed max supply", () => {
    for (const symbol of ["NVA", "VLT"] as const) {
      const buy = quoteBondingCurveBuy({
        market: launchMarketSnapshot(symbol),
        grossFlorins: "100",
      });
      const max = CRYPTO_ASSET_CONFIGS[symbol].maxSupply!;
      assert.ok(buy.treasuryInventoryAfter.plus(buy.circulatingSupplyAfter).equals(max));
    }
  });

  it("cannot buy beyond treasury inventory", () => {
    assert.throws(
      () =>
        quoteBondingCurveBuy({
          market: {
            symbol: "NVA",
            treasuryInventory: "0.00000001",
            circulatingSupply: "999999.99999999",
            protectedReserve: "5000000",
          },
          grossFlorins: "100",
        }),
      (err: unknown) => err instanceof CryptoPricingError && err.code === "INSUFFICIENT_TREASURY",
    );
  });

  it("cannot sell beyond wallet holdings", () => {
    assert.throws(
      () =>
        quoteBondingCurveSell({
          market: {
            symbol: "NVA",
            treasuryInventory: "999000",
            circulatingSupply: "1000",
            protectedReserve: "5000",
            walletAvailable: "1",
          },
          quantity: "2",
        }),
      (err: unknown) => err instanceof CryptoPricingError && err.code === "INSUFFICIENT_WALLET_HOLDINGS",
    );
  });

  it("handles tiny minimum and large orders", () => {
    const tiny = quoteBondingCurveBuy({
      market: launchMarketSnapshot("NVA"),
      grossFlorins: "1.00",
    });
    assert.ok(tiny.executedQuantity.greaterThan(0));
    const large = quoteBondingCurveBuy({
      market: launchMarketSnapshot("VLT"),
      grossFlorins: "100000",
    });
    assert.ok(large.executedQuantity.greaterThan(0));
    assert.ok(large.invariants.supplyConserved);
  });

  it("rejects below-minimum orders", () => {
    assert.throws(
      () => quoteBondingCurveBuy({ market: launchMarketSnapshot("NVA"), grossFlorins: "0.99" }),
      (err: unknown) => err instanceof CryptoPricingError && err.code === "BELOW_MINIMUM_ORDER",
    );
  });

  it("respects exact max-supply boundary", () => {
    const cfg = CRYPTO_ASSET_CONFIGS.NVA;
    // Nearly exhausted treasury: only a dust amount left
    const circulating = cfg.maxSupply!.minus(d("0.00000001"));
    const p = marginalPrice({
      startingPrice: cfg.pegOrStartingPrice,
      curveRate: cfg.curveRate!,
      circulatingSupply: circulating,
    });
    assert.ok(p.greaterThan(cfg.pegOrStartingPrice));
    assert.throws(
      () =>
        quoteBondingCurveBuy({
          market: {
            symbol: "NVA",
            treasuryInventory: "0.00000001",
            circulatingSupply: circulating.toFixed(8),
            protectedReserve: reserveLiability({
              startingPrice: cfg.pegOrStartingPrice,
              curveRate: cfg.curveRate!,
              circulatingSupply: circulating,
            }).toFixed(12),
          },
          grossFlorins: "100",
        }),
      (err: unknown) =>
        err instanceof CryptoPricingError &&
        (err.code === "INSUFFICIENT_TREASURY" || err.code === "EXCEEDS_MAX_SUPPLY"),
    );
  });
});

describe("fees, dust, and concurrency determinism", () => {
  it("fee split reconciles exactly to total collected fee", () => {
    const fees = calculateFeeBreakdown({
      grossValue: "100",
      totalFeeBps: 100,
      revenueFeeBps: 75,
      stabilizationFeeBps: 25,
    });
    assert.ok(fees.revenueAllocation.plus(fees.stabilizationAllocation).equals(fees.totalFee));
    approxEqual(fees.totalFee, "1", "0");
    approxEqual(fees.revenueAllocation, "0.75", "0");
    approxEqual(fees.stabilizationAllocation, "0.25", "0");
  });

  it("rounding dust remains solvent for buys and sells", () => {
    const buy = quoteBondingCurveBuy({
      market: launchMarketSnapshot("NVA"),
      grossFlorins: "33.33",
    });
    assert.ok(buy.roundingDust.greaterThanOrEqualTo(0));
    assert.ok(buy.protectedReserveAfter.greaterThanOrEqualTo(buy.reserveLiabilityAfter));

    const sell = quoteBondingCurveSell({
      market: {
        symbol: "NVA",
        treasuryInventory: buy.treasuryInventoryAfter.toFixed(8),
        circulatingSupply: buy.circulatingSupplyAfter.toFixed(8),
        protectedReserve: buy.protectedReserveAfter.toFixed(12),
        walletAvailable: buy.executedQuantity.toFixed(8),
      },
      quantity: buy.executedQuantity.toFixed(8),
    });
    assert.ok(sell.roundingDust.greaterThanOrEqualTo(0));
    assert.ok(sell.customerPayout.equals(roundDownMoney(sell.fees.netValue)));
    assert.ok(sell.protectedReserveAfter.greaterThanOrEqualTo(sell.reserveLiabilityAfter));
  });

  it("concurrent-quote math remains deterministic", () => {
    const inputs = { market: launchMarketSnapshot("VLT"), grossFlorins: "100" as const };
    const a = quoteBondingCurveBuy(inputs);
    const b = quoteBondingCurveBuy(inputs);
    assert.equal(a.executedQuantity.toFixed(8), b.executedQuantity.toFixed(8));
    assert.equal(a.priceAfter.toFixed(12), b.priceAfter.toFixed(12));
    assert.equal(a.averageExecutionPrice.toFixed(12), b.averageExecutionPrice.toFixed(12));
  });

  it("rejects JavaScript number inputs to authoritative decimal helper", () => {
    assert.throws(() => d(1.5 as unknown as string), /rejects JavaScript number/);
  });
});

describe("wallet public id", () => {
  it("generates opaque acw_ hex ids without sequential structure", () => {
    const id = generateTerminalCryptoPublicWalletId(() => Buffer.alloc(16, 0xab));
    assert.equal(id, "acw_abababababababababababababababab");
    assert.ok(isTerminalCryptoPublicWalletId(id));
    assert.equal(isTerminalCryptoPublicWalletId("acw_1"), false);
    assert.equal(isTerminalCryptoPublicWalletId("user_carter_1"), false);
  });
});

describe("phase 1 seed documents", () => {
  it("keeps all launch assets DRAFT and non-activated", () => {
    const docs = getTerminalCryptoLaunchSeedDocuments();
    assert.equal(docs.length, 3);
    for (const doc of docs) {
      assert.equal(doc.status, "DRAFT");
    }
    assert.equal(docs.find((d) => d.symbol === "NVA")?.curveRate, "0.000632102272727273");
    assert.equal(docs.find((d) => d.symbol === "VLT")?.curveRate, "0.000002556818181818");
  });
});

describe("no-negative invariant sweep", () => {
  it("quotes never produce negative wallet/treasury/circulation/reserve/stabilization values", () => {
    const buy = quoteBondingCurveBuy({
      market: launchMarketSnapshot("NVA"),
      grossFlorins: "100",
    });
    for (const v of [
      buy.treasuryInventoryAfter,
      buy.circulatingSupplyAfter,
      buy.protectedReserveAfter,
      buy.executedQuantity,
      buy.fees.totalFee,
      buy.roundingDust,
    ]) {
      assert.ok(v.greaterThanOrEqualTo(0));
    }
  });
});
