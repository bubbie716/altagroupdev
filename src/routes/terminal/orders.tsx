import type { ReactNode } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrdersList, OrderStatusBadge } from "@/components/terminal/orders-list";
import { MoneyValue } from "@/components/terminal/money-value";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import { cancelTerminalOrder, fetchTerminalOrders } from "@/lib/terminal/terminal.functions";
import { filterOrders } from "@/lib/terminal/market-filters";
import type { OrderRecord, OrderSide, OrderStatus } from "@/lib/terminal/types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/terminal/orders")({
  loader: async () => fetchTerminalOrders(),
  head: () => ({ meta: [{ title: "Orders — Alta Terminal" }] }),
  component: TerminalOrdersPage,
});

function TerminalOrdersPage() {
  const { mode, orders } = Route.useLoaderData();
  const router = useRouter();
  const cancelFn = useServerFn(cancelTerminalOrder);
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [side, setSide] = useState<OrderSide | "all">("all");
  const [selected, setSelected] = useState<OrderRecord | null>(null);

  const filtered = useMemo(() => filterOrders(orders, { status, side }), [orders, status, side]);

  if (mode === "unavailable") {
    return <TerminalUnavailableState />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-medium tracking-tight">Orders</h1>
        <p className="mt-1 text-[13px] text-[var(--terminal-muted)]">
          Open, filled, cancelled, and rejected orders.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterGroup
          label="Status"
          value={status}
          options={["all", "open", "filled", "cancelled", "rejected"]}
          onChange={(v) => setStatus(v as OrderStatus | "all")}
        />
        <FilterGroup
          label="Side"
          value={side}
          options={["all", "buy", "sell"]}
          onChange={(v) => setSide(v as OrderSide | "all")}
        />
      </div>

      <OrdersList
        orders={filtered}
        onSelect={setSelected}
        onCancel={(orderId) => {
          void cancelFn({ data: orderId }).then(() => invalidateRouteData(router));
        }}
      />

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)]">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.symbol}
                  <OrderStatusBadge status={selected.status} />
                </DialogTitle>
                <DialogDescription className="text-[var(--terminal-muted)]">
                  {selected.name}
                </DialogDescription>
              </DialogHeader>
              <dl className="space-y-2 text-[13px]">
                <Detail label="Side" value={selected.side.toUpperCase()} />
                <Detail label="Type" value={selected.type} />
                <Detail
                  label="Quantity"
                  value={`${selected.filledQuantity}/${selected.quantity}`}
                />
                <Detail
                  label="Limit"
                  value={
                    selected.limitPrice != null ? (
                      <MoneyValue value={selected.limitPrice} asPrice size="sm" />
                    ) : (
                      "—"
                    )
                  }
                />
                <Detail
                  label="Avg fill"
                  value={
                    selected.averageFillPrice != null ? (
                      <MoneyValue value={selected.averageFillPrice} asPrice size="sm" />
                    ) : (
                      "—"
                    )
                  }
                />
                <Detail
                  label="Value"
                  value={<MoneyValue value={selected.estimatedValue} size="sm" />}
                />
                <Detail label="Submitted" value={formatActivityDateTime(selected.submittedAt)} />
                {selected.rejectReason ? (
                  <Detail label="Reason" value={selected.rejectReason} />
                ) : null}
              </dl>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--terminal-muted)]">
        {label}
      </span>
      <div className="flex gap-1 rounded-md bg-[var(--terminal-surface)] p-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] capitalize",
              value === option
                ? "bg-[var(--terminal-green)]/15 text-[var(--terminal-green)]"
                : "text-[var(--terminal-muted)]",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--terminal-muted)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
