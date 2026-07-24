import type {
  Holding,
  MarketSessionStatus,
  OrderPreviewInput,
  OrderPreviewResult,
  SecurityDetail,
  SecurityTradingStatus,
} from "@/lib/terminal/types";

const FEE_RATE = 0.001;

export function estimateOrderValue(
  quantity: number,
  price: number,
): { estimatedValue: number; estimatedFees: number } {
  const estimatedValue = Number((quantity * price).toFixed(2));
  const estimatedFees = Number((estimatedValue * FEE_RATE).toFixed(2));
  return { estimatedValue, estimatedFees };
}

export function validateOrderPreview(input: {
  order: OrderPreviewInput;
  security: SecurityDetail | null;
  marketStatus: MarketSessionStatus;
  buyingPower: number;
  holding: Holding | null;
}): OrderPreviewResult {
  const { order, security, marketStatus, buyingPower, holding } = input;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!order.portfolioId?.trim()) {
    return {
      ok: false,
      portfolioId: "",
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      limitPrice: order.limitPrice ?? null,
      estimatedValue: 0,
      estimatedFees: 0,
      buyingPowerAfter: null,
      holdingsAfter: null,
      warnings,
      errors: ["Portfolio is required"],
    };
  }

  if (!security) {
    return {
      ok: false,
      portfolioId: order.portfolioId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      limitPrice: order.limitPrice ?? null,
      estimatedValue: 0,
      estimatedFees: 0,
      buyingPowerAfter: null,
      holdingsAfter: null,
      warnings,
      errors: ["Unknown symbol"],
    };
  }

  if (!(order.quantity > 0) || !Number.isFinite(order.quantity)) {
    errors.push("Enter a valid share quantity");
  }
  if (!Number.isInteger(order.quantity)) {
    errors.push("Share quantity must be a whole number");
  }

  if (order.type === "limit") {
    if (order.limitPrice == null || !(order.limitPrice > 0)) {
      errors.push("Enter a valid limit price");
    }
  }

  if (security.tradingStatus === "halted") {
    errors.push("This security is halted and cannot be traded");
  } else if (security.tradingStatus === "unavailable") {
    errors.push("Market data is unavailable for this security");
  } else if (security.tradingStatus === "delayed") {
    warnings.push("Quotes for this security are delayed");
  }

  if (marketStatus === "closed" || marketStatus === "holiday") {
    errors.push("The market is closed");
  } else if (marketStatus === "pre_market" || marketStatus === "after_hours") {
    warnings.push("Orders placed outside regular hours may not fill until the next session");
  }

  const refPrice =
    order.type === "limit" && order.limitPrice && order.limitPrice > 0
      ? order.limitPrice
      : security.lastPrice;
  const { estimatedValue, estimatedFees } = estimateOrderValue(order.quantity, refPrice);
  const totalDebit = estimatedValue + estimatedFees;

  let buyingPowerAfter: number | null = buyingPower;
  let holdingsAfter: number | null = holding?.quantity ?? 0;

  if (order.side === "buy") {
    if (totalDebit > buyingPower) {
      errors.push("Insufficient buying power for this order");
    }
    buyingPowerAfter = Number((buyingPower - totalDebit).toFixed(2));
    holdingsAfter = (holding?.quantity ?? 0) + order.quantity;
  } else {
    const owned = holding?.quantity ?? 0;
    if (order.quantity > owned) {
      errors.push("You do not hold enough shares to sell");
    }
    buyingPowerAfter = Number((buyingPower + estimatedValue - estimatedFees).toFixed(2));
    holdingsAfter = owned - order.quantity;
  }

  return {
    ok: errors.length === 0,
    portfolioId: order.portfolioId,
    symbol: security.symbol,
    side: order.side,
    type: order.type,
    quantity: order.quantity,
    limitPrice: order.type === "limit" ? (order.limitPrice ?? null) : null,
    estimatedValue,
    estimatedFees,
    buyingPowerAfter,
    holdingsAfter,
    warnings,
    errors,
  };
}

export function tradingStatusLabel(status: SecurityTradingStatus): string {
  switch (status) {
    case "trading":
      return "Trading";
    case "halted":
      return "Halted";
    case "delayed":
      return "Delayed";
    case "unavailable":
      return "Unavailable";
  }
}
