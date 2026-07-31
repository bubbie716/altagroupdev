import { Link } from "@tanstack/react-router";
import type { PortfolioActivityKind, PortfolioActivityRecord } from "@/lib/terminal/types";
import { isTerminalCryptoSymbol } from "@/lib/terminal/crypto/crypto-symbols";
import { MoneyValue } from "@/components/terminal/money-value";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<PortfolioActivityKind, string> = {
  cash_deposit: "Deposit",
  cash_withdrawal: "Withdrawal",
  buy_fill: "Buy",
  sell_fill: "Sell",
  dividend: "Dividend",
  trading_fee: "Fee",
  adjustment: "Adjustment",
  realized_gain_loss: "Realized P/L",
};

function activityBadgeLabel(row: PortfolioActivityRecord): string {
  const crypto = row.symbol ? isTerminalCryptoSymbol(row.symbol) : false;
  const desc = row.description.toLowerCase();

  if (/wallet assigned/i.test(row.description)) return "Wallet assigned";
  if (crypto && row.kind === "trading_fee") return "Crypto trading fee";
  if (crypto && row.kind === "buy_fill") return `Bought ${row.symbol}`;
  if (crypto && row.kind === "sell_fill") return `Sold ${row.symbol}`;
  if (crypto && row.kind === "trading_fee") return "Crypto trading fee";
  if (/crypto trading fee/i.test(desc)) return "Crypto trading fee";
  return KIND_LABEL[row.kind];
}

export function ActivityList({
  activity,
  emptyMessage = "No activity yet for this portfolio.",
  limit,
}: {
  activity: PortfolioActivityRecord[];
  emptyMessage?: string;
  limit?: number;
}) {
  const rows = limit ? activity.slice(0, limit) : activity;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--terminal-border)] px-4 py-8 text-center">
        <p className="text-[14px] font-medium">No activity</p>
        <p className="mt-1 text-[13px] text-[var(--terminal-muted)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--terminal-border)] overflow-hidden rounded-lg border border-[var(--terminal-border)]">
      {rows.map((row) => {
        const crypto = row.symbol ? isTerminalCryptoSymbol(row.symbol) : false;
        const isWalletAssigned = /wallet assigned/i.test(row.description);
        return (
          <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[var(--menu-item-selected)] px-1.5 py-0.5 text-[11px] font-medium">
                  {activityBadgeLabel(row)}
                </span>
                {crypto && !isWalletAssigned ? (
                  <span className="rounded-md border border-[var(--terminal-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--terminal-muted)]">
                    Crypto
                  </span>
                ) : null}
                {row.symbol && !isWalletAssigned ? (
                  <Link
                    to="/terminal/security/$symbol"
                    params={{ symbol: row.symbol }}
                    search={{
                      range: "1D",
                      portfolioId: undefined,
                      instrument: crypto ? "crypto" : undefined,
                    }}
                    className="text-[13px] font-medium text-[var(--terminal-green)] hover:underline"
                  >
                    {row.symbol}
                  </Link>
                ) : null}
              </div>
              <p className="mt-1 text-[13px] text-[var(--terminal-text)]">{row.description}</p>
              <p className="mt-0.5 text-[11px] text-[var(--terminal-muted)]">
                {formatActivityDateTime(row.occurredAt)}
                {row.orderId ? ` · Order ${row.orderId.slice(-8)}` : ""}
              </p>
            </div>
            {isWalletAssigned && row.amount === 0 ? (
              <span className="shrink-0 text-[12px] text-[var(--terminal-muted)]">—</span>
            ) : (
              <MoneyValue
                value={row.amount}
                signed
                size="sm"
                className={cn(
                  "shrink-0",
                  row.amount < 0 ? "text-[var(--terminal-red)]" : "text-[var(--terminal-green)]",
                )}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
