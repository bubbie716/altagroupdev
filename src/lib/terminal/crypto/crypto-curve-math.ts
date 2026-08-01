/**
 * Pure linear reserve-backed bonding-curve primitives.
 * P(q) = P0 + k q
 * L(q) = P0 q + ½ k q²
 *
 * Inverse of net florin spend into Δq (at circulating q0):
 *   (k/2) Δq² + P(q0) Δq − N = 0
 *   Δq = (−P + √(P² + 2 k N)) / k
 */

import { Prisma } from "@prisma/client";
import { d, type CryptoDecimal, type CryptoDecimalInput } from "./crypto-decimal";

const Decimal = Prisma.Decimal;

export function marginalPrice(input: {
  startingPrice: CryptoDecimalInput;
  curveRate: CryptoDecimalInput;
  circulatingSupply: CryptoDecimalInput;
}): CryptoDecimal {
  const p0 = d(input.startingPrice);
  const k = d(input.curveRate);
  const q = d(input.circulatingSupply);
  return p0.plus(k.mul(q));
}

export function reserveLiability(input: {
  startingPrice: CryptoDecimalInput;
  curveRate: CryptoDecimalInput;
  circulatingSupply: CryptoDecimalInput;
}): CryptoDecimal {
  const p0 = d(input.startingPrice);
  const k = d(input.curveRate);
  const q = d(input.circulatingSupply);
  // L(q) = P0 q + 0.5 k q²
  return p0.mul(q).plus(k.mul(q).mul(q).mul("0.5"));
}

/** Gross florin value of moving circulating supply from qFrom → qTo along the curve (unsigned). */
export function curveIntegralValue(input: {
  startingPrice: CryptoDecimalInput;
  curveRate: CryptoDecimalInput;
  qFrom: CryptoDecimalInput;
  qTo: CryptoDecimalInput;
}): CryptoDecimal {
  const a = reserveLiability({
    startingPrice: input.startingPrice,
    curveRate: input.curveRate,
    circulatingSupply: input.qFrom,
  });
  const b = reserveLiability({
    startingPrice: input.startingPrice,
    curveRate: input.curveRate,
    circulatingSupply: input.qTo,
  });
  return b.minus(a).abs();
}

/**
 * Solve Δq for a buy that deposits `netFlorins` into the curve starting at circulating `q0`.
 * Uses the exact quadratic inverse — not florins / displayedPrice.
 */
export function quantityFromNetBuy(input: {
  startingPrice: CryptoDecimalInput;
  curveRate: CryptoDecimalInput;
  circulatingSupply: CryptoDecimalInput;
  netFlorins: CryptoDecimalInput;
}): CryptoDecimal {
  const k = d(input.curveRate);
  const net = d(input.netFlorins);
  if (!net.greaterThan(0)) return d("0");
  if (!k.greaterThan(0)) {
    throw new Error("curveRate must be positive for bonding-curve buys");
  }
  const p = marginalPrice({
    startingPrice: input.startingPrice,
    curveRate: input.curveRate,
    circulatingSupply: input.circulatingSupply,
  });
  // Δq = (−P + √(P² + 2 k N)) / k
  const discriminant = p.mul(p).plus(k.mul(net).mul(2));
  if (discriminant.lessThan(0)) {
    throw new Error("Bonding-curve buy discriminant is negative");
  }
  return p.neg().plus(discriminant.sqrt()).div(k);
}

/** Net florins returned by selling `quantity` coins at circulating `q0` (before fees). */
export function netFromSellQuantity(input: {
  startingPrice: CryptoDecimalInput;
  curveRate: CryptoDecimalInput;
  circulatingSupply: CryptoDecimalInput;
  quantity: CryptoDecimalInput;
}): CryptoDecimal {
  const q0 = d(input.circulatingSupply);
  const qty = d(input.quantity);
  const q1 = q0.minus(qty);
  if (q1.lessThan(0)) {
    throw new Error("Sell quantity exceeds circulating supply");
  }
  return curveIntegralValue({
    startingPrice: input.startingPrice,
    curveRate: input.curveRate,
    qFrom: q1,
    qTo: q0,
  });
}

/**
 * Solve Δq for a sell that redeems `grossFlorins` from the curve at circulating `q0`.
 * Inverse of netFromSellQuantity: N = P Δq − ½ k Δq²
 *   Δq = (P − √(P² − 2 k N)) / k
 */
export function quantityFromGrossSell(input: {
  startingPrice: CryptoDecimalInput;
  curveRate: CryptoDecimalInput;
  circulatingSupply: CryptoDecimalInput;
  grossFlorins: CryptoDecimalInput;
}): CryptoDecimal {
  const k = d(input.curveRate);
  const net = d(input.grossFlorins);
  if (!net.greaterThan(0)) return d("0");
  if (!k.greaterThan(0)) {
    throw new Error("curveRate must be positive for bonding-curve sells");
  }
  const p = marginalPrice({
    startingPrice: input.startingPrice,
    curveRate: input.curveRate,
    circulatingSupply: input.circulatingSupply,
  });
  const discriminant = p.mul(p).minus(k.mul(net).mul(2));
  if (discriminant.lessThan(0)) {
    throw new Error("Requested sell florin amount exceeds available curve liquidity");
  }
  const qty = p.minus(discriminant.sqrt()).div(k);
  const circulating = d(input.circulatingSupply);
  if (qty.greaterThan(circulating)) {
    throw new Error("Sell quantity exceeds circulating supply");
  }
  return qty;
}

export function averageExecutionPrice(grossCurveValue: CryptoDecimalInput, quantity: CryptoDecimalInput): CryptoDecimal {
  const qty = d(quantity);
  if (!qty.greaterThan(0)) {
    throw new Error("averageExecutionPrice requires positive quantity");
  }
  return d(grossCurveValue).div(qty);
}

/** Keep Discriminant math using Decimal.sqrt (banker's precision), not Math.sqrt. */
export function assertDecimalSqrtAvailable(): void {
  const sample = new Decimal("4").sqrt();
  if (!sample.equals(2)) {
    throw new Error("Prisma.Decimal.sqrt is unavailable or incorrect");
  }
}
