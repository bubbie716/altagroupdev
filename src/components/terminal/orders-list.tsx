"use client";

import type { OrderRecord, OrderStatus } from "@/lib/terminal/types";
import { MoneyValue } from "@/components/terminal/money-value";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    open: "text-[var(--terminal-green)] border-[var(--terminal-green)]/30",
    filled: "text-[var(--terminal-text)] border-[var(--terminal-border)]",
    cancelled: "text-[var(--terminal-muted)] border-[var(--terminal-border)]",
    rejected: "text-[var(--terminal-red)] border-[var(--terminal-red)]/30",
    partial: "text-[var(--terminal-text)] border-[var(--terminal-border)]",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}

function isCryptoOrder(order: OrderRecord): boolean {
  return order.instrumentKind === "CRYPTO" || order.executionVenue === "ALTA_CRYPTO";
}

function orderSubtitle(order: OrderRecord): string {
  if (isCryptoOrder(order)) {
    const qty =
      order.cryptoSettlement?.executedQuantity ??
      (order.filledQuantity > 0 ? String(order.filledQuantity) : String(order.quantity));
    return `${qty} ${order.symbol} · Market`;
  }
  return `${order.quantity} shares · ${order.type}`;
}

export function OrdersList({
  orders,
  onSelect,
  onCancel,
}: {
  orders: OrderRecord[];
  onSelect?: (order: OrderRecord) => void;
  onCancel?: (orderId: string) => void;
}) {
  if (!orders.length) {
    return (
      <div className="rounded-lg border border-[var(--terminal-border)] px-4 py-10 text-center">
        <p className="text-[15px] font-medium">No orders yet</p>
        <p className="mt-2 text-[13px] text-[var(--terminal-muted)]">
          Buy and sell orders you place will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--terminal-border)]" aria-label="Orders">
      {orders.map((order) => {
        const crypto = isCryptoOrder(order);
        return (
          <li key={order.id} className="flex flex-wrap items-center gap-3 py-3.5">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => onSelect?.(order)}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{order.symbol}</span>
                <span
                  className={cn(
                    "text-[11px] uppercase tracking-[0.12em]",
                    order.side === "buy"
                      ? "text-[var(--terminal-green)]"
                      : "text-[var(--terminal-red)]",
                  )}
                >
                  {order.side}
                </span>
                {crypto ? (
                  <span className="inline-flex rounded-md border border-[var(--terminal-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--terminal-muted)]">
                    Crypto
                  </span>
                ) : null}
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="mt-1 text-[12px] text-[var(--terminal-muted)]">
                {orderSubtitle(order)}
                {!crypto && order.limitPrice != null ? ` @ ` : ""}
                {!crypto && order.limitPrice != null ? (
                  <MoneyValue value={order.limitPrice} asPrice size="sm" />
                ) : null}
                {" · "}
                {formatActivityDateTime(order.submittedAt)}
              </p>
            </button>
            <div className="text-right">
              <MoneyValue value={order.estimatedValue} size="sm" />
              {order.status === "open" && onCancel && !crypto ? (
                <button
                  type="button"
                  className="mt-1 block text-[12px] text-[var(--terminal-muted)] hover:text-[var(--terminal-red)]"
                  onClick={() => onCancel(order.id)}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
