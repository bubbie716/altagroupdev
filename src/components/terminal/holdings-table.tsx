"use client";

import { Link } from "@tanstack/react-router";
import type { Holding } from "@/lib/terminal/types";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { Sparkline } from "@/components/terminal/sparkline";
import { cn } from "@/lib/utils";

export function HoldingsTable({
  holdings,
  className,
}: {
  holdings: Holding[];
  className?: string;
}) {
  if (!holdings.length) {
    return (
      <div className="rounded-lg border border-[var(--terminal-border)] px-4 py-10 text-center">
        <p className="text-[15px] font-medium">No holdings yet</p>
        <p className="mt-2 text-[13px] text-[var(--terminal-muted)]">
          Explore markets to find securities and place your first order.
        </p>
        <Link
          to="/terminal/markets"
          search={{ q: "", filter: "all" }}
          className="mt-4 inline-flex rounded-md bg-[var(--terminal-green)] px-4 py-2 text-[13px] font-medium text-black"
        >
          Browse markets
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className={cn("hidden md:block overflow-x-auto", className)}>
        <table className="terminal-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Avg cost</th>
              <th className="text-right">Price</th>
              <th className="text-right">Value</th>
              <th className="text-right">Total return</th>
              <th className="text-right">Day</th>
              <th className="text-right">Weight</th>
              <th className="text-right">Trend</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.symbol}>
                <td>
                  <Link
                    to="/terminal/security/$symbol"
                    params={{ symbol: h.symbol }}
                    search={{ range: "1D" }}
                    className="font-medium hover:text-[var(--terminal-green)]"
                  >
                    {h.symbol}
                  </Link>
                  <div className="mt-0.5 max-w-[160px] truncate text-[11px] text-[var(--terminal-muted)]">
                    {h.name}
                  </div>
                </td>
                <td className="text-right">{h.quantity}</td>
                <td className="text-right">
                  <MoneyValue value={h.averageCost} asPrice size="sm" />
                </td>
                <td className="text-right">
                  <MoneyValue value={h.lastPrice} asPrice size="sm" />
                </td>
                <td className="text-right">
                  <MoneyValue value={h.marketValue} size="sm" />
                </td>
                <td className="text-right">
                  <PriceChange amount={h.totalReturn} percent={h.totalReturnPercent} compact />
                </td>
                <td className="text-right">
                  <PriceChange amount={h.dayReturn} percent={h.dayReturnPercent} compact />
                </td>
                <td className="text-right text-[var(--terminal-muted)]">
                  {h.weightPercent.toFixed(1)}%
                </td>
                <td className="text-right">
                  <Sparkline data={h.sparkline} positive={h.dayReturn >= 0} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-0 md:hidden" aria-label="Holdings">
        {holdings.map((h) => (
          <li key={h.symbol} className="border-b border-[var(--terminal-border)] py-3.5">
            <Link
              to="/terminal/security/$symbol"
              params={{ symbol: h.symbol }}
              search={{ range: "1D" }}
              className="block"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{h.symbol}</p>
                  <p className="text-[12px] text-[var(--terminal-muted)]">
                    {h.quantity} sh · {h.weightPercent.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right">
                  <MoneyValue value={h.marketValue} size="sm" />
                  <div className="mt-0.5">
                    <PriceChange amount={h.totalReturn} percent={h.totalReturnPercent} compact />
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function AllocationBars({ holdings }: { holdings: Holding[] }) {
  if (!holdings.length) return null;
  return (
    <div className="space-y-3" aria-label="Portfolio allocation">
      {holdings.map((h) => (
        <div key={h.symbol}>
          <div className="mb-1 flex justify-between text-[12px]">
            <span>{h.symbol}</span>
            <span className="tabular-nums text-[var(--terminal-muted)]">
              {h.weightPercent.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--terminal-surface-2)]">
            <div
              className="h-full rounded-full bg-[var(--terminal-green)]"
              style={{ width: `${Math.min(100, h.weightPercent)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
