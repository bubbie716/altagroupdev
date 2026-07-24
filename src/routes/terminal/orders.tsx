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
import { PortfolioSwitcher } from "@/components/terminal/portfolio-switcher";
import {
  cancelTerminalOrder,
  fetchEligibleTerminalCompanies,
  fetchTerminalOrders,
} from "@/lib/terminal/terminal.functions";
import { filterOrders } from "@/lib/terminal/market-filters";
import type { OrderRecord, OrderSide, OrderStatus } from "@/lib/terminal/types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";
import { cn } from "@/lib/utils";
import { RoutePendingFallback } from "@/components/ui/route-pending-fallback";

export const Route = createFileRoute("/terminal/orders")({
  validateSearch: (search: Record<string, unknown>) => ({
    portfolioId: typeof search.portfolioId === "string" ? search.portfolioId : undefined,
  }),
  loaderDeps: ({ search }) => ({ portfolioId: search.portfolioId }),
  loader: async ({ deps }) => {
    const [orders, eligibleCompanies] = await Promise.all([
      fetchTerminalOrders({ data: { portfolioId: deps.portfolioId } }),
      fetchEligibleTerminalCompanies(),
    ]);
    return { ...orders, eligibleCompanies };
  },
  pendingComponent: () => <RoutePendingFallback label="Loading orders" />,
  head: () => ({ meta: [{ title: "Orders — Alta Terminal" }] }),
  component: TerminalOrdersPage,
});

function TerminalOrdersPage() {
  const { mode, orders, portfolios, selectedPortfolio, eligibleCompanies } = Route.useLoaderData();
  const navigate = Route.useNavigate();
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-medium tracking-tight">Orders</h1>
          <p className="mt-1 text-[13px] text-[var(--terminal-muted)]">
            Open, filled, cancelled, and rejected orders
            {selectedPortfolio ? ` for ${selectedPortfolio.name}` : ""}.
          </p>
        </div>
        <PortfolioSwitcher
          portfolios={portfolios}
          selectedId={selectedPortfolio?.id ?? null}
          eligibleCompanies={eligibleCompanies}
          onSelect={(id) => {
            void navigate({ search: { portfolioId: id }, replace: true });
          }}
          onCreated={(p) => {
            void navigate({ search: { portfolioId: p.id }, replace: true });
          }}
        />
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
          if (!selectedPortfolio) return;
          void cancelFn({
            data: { portfolioId: selectedPortfolio.id, orderId },
          }).then(() => invalidateRouteData(router));
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
                  {selected.name} · {selected.side} {selected.type}
                </DialogDescription>
              </DialogHeader>
              <dl className="mt-2 grid grid-cols-2 gap-3 text-[13px]">
                <Detail label="Quantity" value={String(selected.quantity)} />
                <Detail label="Filled" value={String(selected.filledQuantity)} />
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
                  label="Est. value"
                  value={<MoneyValue value={selected.estimatedValue} size="sm" />}
                />
                <Detail label="Submitted" value={formatActivityDateTime(selected.submittedAt)} />
                <Detail label="Updated" value={formatActivityDateTime(selected.updatedAt)} />
              </dl>
              {selected.rejectReason ? (
                <p className="mt-3 text-[13px] text-[var(--terminal-red)]">{selected.rejectReason}</p>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-[var(--terminal-muted)]">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
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
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-[12px] capitalize",
            value === option
              ? "bg-[var(--terminal-surface-2)] text-[var(--terminal-text)]"
              : "text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
