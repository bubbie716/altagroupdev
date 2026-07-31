"use client";

import { Link } from "@tanstack/react-router";
import type { CryptoPortfolioBalance } from "@/lib/terminal/crypto/crypto-market-read.service";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { cn } from "@/lib/utils";

export function CryptoHoldingsTable({
  balances,
  portfolioId,
  className,
}: {
  balances: CryptoPortfolioBalance[];
  portfolioId?: string | null;
  className?: string;
}) {
  if (!balances.length) return null;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="terminal-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Avg cost</th>
            <th className="text-right">Price</th>
            <th className="text-right">Value</th>
            <th className="text-right">Total return</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((b) => {
            const qty = Number.parseFloat(b.quantity);
            const avgCost = Number.parseFloat(b.averageCost);
            const price = Number.parseFloat(b.currentPrice);
            const value = Number.parseFloat(b.markedValue);
            const ret = b.totalReturn != null ? Number.parseFloat(b.totalReturn) : null;
            const retPct =
              b.totalReturnPercent != null ? Number.parseFloat(b.totalReturnPercent) : null;
            return (
              <tr key={b.symbol}>
                <td>
                  <Link
                    to="/terminal/security/$symbol"
                    params={{ symbol: b.symbol }}
                    search={{
                      range: "1D",
                      portfolioId: portfolioId ?? undefined,
                      instrument: "crypto",
                    }}
                    className="font-medium hover:text-[var(--terminal-green)]"
                  >
                    {b.symbol}
                  </Link>
                  <div className="mt-0.5 max-w-[160px] truncate text-[11px] text-[var(--terminal-muted)]">
                    {b.displayName}
                  </div>
                </td>
                <td className="text-right font-mono text-[13px]">
                  {Number.isFinite(qty) ? `${qty} ${b.symbol}` : b.quantity}
                </td>
                <td className="text-right">
                  <MoneyValue value={avgCost} asPrice size="sm" cryptoSymbol={b.symbol} />
                </td>
                <td className="text-right">
                  <MoneyValue value={price} asPrice size="sm" cryptoSymbol={b.symbol} />
                </td>
                <td className="text-right">
                  <MoneyValue value={value} size="sm" />
                </td>
                <td className="text-right">
                  <PriceChange amount={ret} percent={retPct} compact cryptoSymbol={b.symbol} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
