"use client";

import { useEffect, useState } from "react";
import type { OrderSide, OrderType } from "@/lib/terminal/types";

export type OrderTicketDraft = {
  side: OrderSide;
  type: OrderType;
  quantity: string;
  limitPrice: string;
  setSide: (side: OrderSide) => void;
  setType: (type: OrderType) => void;
  setQuantity: (quantity: string) => void;
  setLimitPrice: (limitPrice: string) => void;
};

/** Shared order-ticket draft so mobile sheet close/reopen and desktop stay in sync. */
export function useOrderTicketDraft(lastPrice: number): OrderTicketDraft {
  const [side, setSide] = useState<OrderSide>("buy");
  const [type, setType] = useState<OrderType>("market");
  const [quantity, setQuantity] = useState("1");
  const [limitPrice, setLimitPrice] = useState(() => String(lastPrice));

  useEffect(() => {
    setLimitPrice(String(lastPrice));
  }, [lastPrice]);

  return {
    side,
    type,
    quantity,
    limitPrice,
    setSide,
    setType,
    setQuantity,
    setLimitPrice,
  };
}
