import { validateOrderPreview } from "@/lib/terminal/order-validation";
import type {
  Holding,
  MarketSessionStatus,
  OrderSide,
  OrderType,
  SecurityDetail,
} from "@/lib/terminal/types";

/** Trade-specific fields reset by “Trade another” — portfolio is preserved. */
export type QuickTradeFields = {
  symbol: string | null;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  limitPrice: string;
};

export const QUICK_TRADE_DEFAULT_FIELDS: QuickTradeFields = {
  symbol: null,
  side: "buy",
  type: "market",
  quantity: "1",
  limitPrice: "",
};

export function resetQuickTradeFields(
  preserve: Pick<QuickTradeFields, never> | { lastPrice?: number } = {},
): QuickTradeFields {
  const lastPrice = "lastPrice" in preserve ? preserve.lastPrice : undefined;
  return {
    ...QUICK_TRADE_DEFAULT_FIELDS,
    limitPrice: lastPrice != null && Number.isFinite(lastPrice) ? String(lastPrice) : "",
  };
}

/** Client-side gate for Review — mirrors server validateOrderPreview rules. */
export function getQuickTradeReviewErrors(input: {
  portfolioId: string | null;
  security: SecurityDetail | null;
  marketStatus: MarketSessionStatus;
  buyingPower: number;
  holding: Holding | null;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  limitPrice: string;
  canTradeSelected: boolean;
  tradeBlockedReason?: string | null;
  modeUnavailable?: boolean;
}): string[] {
  if (input.modeUnavailable) {
    return ["Market connection unavailable"];
  }
  if (!input.portfolioId?.trim()) {
    return ["Select a portfolio"];
  }
  if (!input.canTradeSelected) {
    return [input.tradeBlockedReason ?? "This portfolio cannot place orders"];
  }
  if (!input.security) {
    return ["Select a security"];
  }

  const qty = Number(input.quantity);
  const limit =
    input.type === "limit" ? Number(input.limitPrice) : null;

  const preview = validateOrderPreview({
    order: {
      portfolioId: input.portfolioId,
      symbol: input.security.symbol,
      side: input.side,
      type: input.type,
      quantity: Number.isFinite(qty) ? qty : NaN,
      limitPrice: input.type === "limit" ? (Number.isFinite(limit) ? limit : null) : null,
    },
    security: input.security,
    marketStatus: input.marketStatus,
    buyingPower: input.buyingPower,
    holding: input.holding,
  });

  return preview.errors;
}

export function canReviewQuickTrade(errors: string[]): boolean {
  return errors.length === 0;
}

/** Ensure preview/submit payloads always carry an explicit portfolio id. */
export function requireExplicitPortfolioId(portfolioId: string | null | undefined): string {
  const id = portfolioId?.trim() ?? "";
  if (!id) {
    throw new Error("Portfolio is required");
  }
  return id;
}
