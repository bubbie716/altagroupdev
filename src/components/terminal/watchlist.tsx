"use client";

import { Link } from "@tanstack/react-router";
import type { WatchlistItem } from "@/lib/terminal/types";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { Sparkline } from "@/components/terminal/sparkline";
import { SecurityStatusBadge } from "@/components/terminal/market-status";

export function WatchlistPanel({
  items,
  onRemove,
  busySymbol,
}: {
  items: WatchlistItem[];
  onRemove?: (symbol: string) => void;
  busySymbol?: string | null;
}) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-[var(--terminal-border)] px-4 py-10 text-center">
        <p className="text-[15px] font-medium">Your watchlist is empty</p>
        <p className="mt-2 text-[13px] text-[var(--terminal-muted)]">
          Add symbols from Markets to track prices here.
        </p>
        <Link
          to="/terminal/markets"
          search={{ q: "", filter: "all" }}
          className="mt-4 inline-flex rounded-md bg-[var(--terminal-green)] px-4 py-2 text-[13px] font-medium text-black"
        >
          Discover markets
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--terminal-border)]" aria-label="Watchlist">
      {items.map((item) => (
        <li key={item.symbol} className="flex items-center gap-3 py-3.5">
          <Link
            to="/terminal/security/$symbol"
            params={{ symbol: item.symbol }}
            search={{ range: "1D", portfolioId: undefined }}
            className="min-w-0 flex-1"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{item.symbol}</span>
              <SecurityStatusBadge status={item.tradingStatus} />
            </div>
            <p className="mt-0.5 truncate text-[12px] text-[var(--terminal-muted)]">{item.name}</p>
          </Link>
          <Sparkline data={item.sparkline} positive={item.dayChange >= 0} width={56} height={24} />
          <div className="min-w-[88px] text-right">
            <MoneyValue value={item.lastPrice} asPrice size="sm" />
            <div className="mt-0.5">
              <PriceChange amount={item.dayChange} percent={item.dayChangePercent} compact />
            </div>
          </div>
          {onRemove ? (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[12px] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]"
              onClick={() => onRemove(item.symbol)}
              disabled={busySymbol === item.symbol}
              aria-label={`Remove ${item.symbol} from watchlist`}
            >
              Remove
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
