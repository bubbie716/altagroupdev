"use client";

import { Link } from "@tanstack/react-router";
import type { SecuritySummary } from "@/lib/terminal/types";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { Sparkline } from "@/components/terminal/sparkline";
import { SecurityStatusBadge } from "@/components/terminal/market-status";
import { formatCompactVolume } from "@/lib/terminal/format";
import { cn } from "@/lib/utils";

export function MarketTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  rows: SecuritySummary[];
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: "symbol" | "name" | "lastPrice" | "dayChangePercent" | "volume") => void;
  className?: string;
}) {
  return (
    <>
      <div className={cn("hidden md:block overflow-x-auto", className)}>
        <table className="terminal-table">
          <thead>
            <tr>
              <SortTh
                label="Symbol"
                active={sortKey === "symbol"}
                dir={sortDir}
                onClick={() => onSort?.("symbol")}
              />
              <SortTh
                label="Company"
                active={sortKey === "name"}
                dir={sortDir}
                onClick={() => onSort?.("name")}
              />
              <SortTh
                label="Price"
                active={sortKey === "lastPrice"}
                dir={sortDir}
                onClick={() => onSort?.("lastPrice")}
                align="right"
              />
              <SortTh
                label="Day"
                active={sortKey === "dayChangePercent"}
                dir={sortDir}
                onClick={() => onSort?.("dayChangePercent")}
                align="right"
              />
              <SortTh
                label="Volume"
                active={sortKey === "volume"}
                dir={sortDir}
                onClick={() => onSort?.("volume")}
                align="right"
              />
              <th className="text-right">Trend</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol}>
                <td>
                  <Link
                    to="/terminal/security/$symbol"
                    params={{ symbol: row.symbol }}
                    search={{ range: "1D", portfolioId: undefined, instrument: undefined }}
                    className="font-medium text-[var(--terminal-text)] hover:text-[var(--terminal-green)]"
                  >
                    {row.symbol}
                  </Link>
                </td>
                <td className="max-w-[220px] truncate text-[var(--terminal-muted)]">{row.name}</td>
                <td className="text-right">
                  <MoneyValue value={row.lastPrice} asPrice size="sm" />
                </td>
                <td className="text-right">
                  <PriceChange amount={row.dayChange} percent={row.dayChangePercent} compact />
                </td>
                <td className="text-right text-[var(--terminal-muted)]">
                  {formatCompactVolume(row.volume)}
                </td>
                <td className="text-right">
                  <Sparkline
                    data={row.sparkline}
                    positive={row.dayChange >= 0}
                    label={`${row.symbol} day trend`}
                  />
                </td>
                <td>
                  <SecurityStatusBadge status={row.tradingStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className={cn("w-full min-w-0 space-y-0 overflow-hidden md:hidden", className)} aria-label="Markets">
        {rows.map((row) => (
          <li key={row.symbol} className="min-w-0 max-w-full overflow-hidden border-b border-[var(--terminal-border)]">
            <Link
              to="/terminal/security/$symbol"
              params={{ symbol: row.symbol }}
              search={{ range: "1D", portfolioId: undefined, instrument: undefined }}
              className="flex min-w-0 w-full items-center gap-2 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{row.symbol}</span>
                  <SecurityStatusBadge status={row.tradingStatus} />
                </div>
                <p className="mt-0.5 truncate text-[12px] text-[var(--terminal-muted)]">
                  {row.name}
                </p>
              </div>
              <span className="shrink-0">
                <Sparkline
                  data={row.sparkline}
                  positive={row.dayChange >= 0}
                  width={56}
                  height={24}
                />
              </span>
              <div className="min-w-0 shrink-0 text-right">
                <MoneyValue value={row.lastPrice} asPrice size="sm" />
                <div className="mt-0.5">
                  <PriceChange amount={row.dayChange} percent={row.dayChangePercent} compact />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function SortTh({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-[0.04em]",
          align === "right" && "ml-auto",
          active ? "text-[var(--terminal-text)]" : "text-[var(--terminal-muted)]",
        )}
      >
        {label}
        {active ? <span aria-hidden>{dir === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}
