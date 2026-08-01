"use client";

import { cn } from "@/lib/utils";
import type { OrderSide } from "@/lib/terminal/types";

/** Compact sticky Buy/Sell bar above Terminal mobile bottom nav. */
export function MobileTradeActionBar({
  onTrade,
  disabled = false,
  className,
}: {
  onTrade: (side: OrderSide) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-[45] border-t border-[var(--terminal-border)] bg-[var(--terminal-bg)]/95 px-3 py-2.5 backdrop-blur-sm",
        // Sit above bottom nav (~52px) + safe area; hidden when desktop order aside shows.
        "bottom-[calc(3.25rem+env(safe-area-inset-bottom,0px))] md:bottom-0 lg:hidden",
        className,
      )}
      role="region"
      aria-label="Trade actions"
    >
      <div className="mx-auto grid max-w-[1120px] grid-cols-2 gap-2">
        <button
          type="button"
          data-trade-side="buy"
          disabled={disabled}
          onClick={() => onTrade("buy")}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--terminal-green)] px-4 text-[15px] font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          Buy
        </button>
        <button
          type="button"
          data-trade-side="sell"
          disabled={disabled}
          onClick={() => onTrade("sell")}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--terminal-red)] px-4 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sell
        </button>
      </div>
    </div>
  );
}
