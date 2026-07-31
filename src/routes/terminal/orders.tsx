import type { ReactNode } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
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
import { PortfolioSwitcher } from "@/components/terminal/portfolio-switcher";
import { ScheduleTradeSheet } from "@/components/terminal/schedule-trade-sheet";
import {
  cancelScheduledTradeFn,
  fetchScheduledTradeDetailFn,
  fetchScheduledTradesFn,
  pauseScheduledTradeFn,
  resumeScheduledTradeFn,
} from "@/lib/terminal/scheduled-trade.functions";
import {
  cancelTerminalOrder,
  fetchEligibleTerminalCompanies,
  fetchTerminalOrders,
} from "@/lib/terminal/terminal.functions";
import { filterOrders } from "@/lib/terminal/market-filters";
import type { ScheduledTradeInstructionRow } from "@/lib/terminal/scheduled-trade-types";
import { scheduledTradeFrequencyLabel } from "@/lib/terminal/scheduled-trade-copy";
import type { OrderRecord, OrderSide, OrderStatus } from "@/lib/terminal/types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";
import { cn } from "@/lib/utils";
import { RoutePendingFallback } from "@/components/ui/route-pending-fallback";

const ORDER_STATUSES = ["all", "open", "filled", "cancelled", "rejected", "partial"] as const;
const ORDER_SIDES = ["all", "buy", "sell"] as const;
const TABS = ["orders", "scheduled"] as const;

type OrdersStatusFilter = (typeof ORDER_STATUSES)[number];
type OrdersSideFilter = (typeof ORDER_SIDES)[number];
type OrdersTab = (typeof TABS)[number];

function parseStatus(value: unknown): OrdersStatusFilter {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as OrdersStatusFilter)
    : "all";
}

function parseSide(value: unknown): OrdersSideFilter {
  return typeof value === "string" && (ORDER_SIDES as readonly string[]).includes(value)
    ? (value as OrdersSideFilter)
    : "all";
}

function parseTab(value: unknown): OrdersTab {
  return value === "scheduled" ? "scheduled" : "orders";
}

export type TerminalOrdersSearch = {
  portfolioId?: string;
  status: OrdersStatusFilter;
  side: OrdersSideFilter;
  tab?: OrdersTab;
  instructionId?: string;
};

export const Route = createFileRoute("/terminal/orders")({
  validateSearch: (search: Record<string, unknown>): TerminalOrdersSearch => ({
    portfolioId: typeof search.portfolioId === "string" ? search.portfolioId : undefined,
    status: parseStatus(search.status),
    side: parseSide(search.side),
    tab: parseTab(search.tab),
    instructionId: typeof search.instructionId === "string" ? search.instructionId : undefined,
  }),
  loaderDeps: ({ search }) => ({
    portfolioId: search.portfolioId,
    tab: search.tab ?? "orders",
    instructionId: search.instructionId,
  }),
  loader: async ({ deps }) => {
    const [orders, eligibleCompanies, scheduled] = await Promise.all([
      fetchTerminalOrders({ data: { portfolioId: deps.portfolioId } }),
      fetchEligibleTerminalCompanies(),
      deps.tab === "scheduled" || deps.instructionId
        ? fetchScheduledTradesFn({ data: deps.portfolioId })
        : Promise.resolve([] as ScheduledTradeInstructionRow[]),
    ]);
    const scheduledDetail = deps.instructionId
      ? await fetchScheduledTradeDetailFn({ data: deps.instructionId }).catch(() => null)
      : null;
    return { ...orders, eligibleCompanies, scheduled, scheduledDetail };
  },
  pendingComponent: () => <RoutePendingFallback label="Loading orders" />,
  head: () => ({ meta: [{ title: "Orders — Alta Terminal" }] }),
  component: TerminalOrdersPage,
});

function TerminalOrdersPage() {
  const { mode, orders, portfolios, selectedPortfolio, eligibleCompanies, scheduled, scheduledDetail } =
    Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const cancelFn = useServerFn(cancelTerminalOrder);
  const pauseFn = useServerFn(pauseScheduledTradeFn);
  const resumeFn = useServerFn(resumeScheduledTradeFn);
  const cancelScheduleFn = useServerFn(cancelScheduledTradeFn);
  const [selected, setSelected] = useState<OrderRecord | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const tab = search.tab ?? "orders";
  const status = search.status;
  const side = search.side;
  const filtered = useMemo(() => filterOrders(orders, { status, side }), [orders, status, side]);

  function updateSearch(patch: Partial<TerminalOrdersSearch>) {
    void navigate({
      search: (prev) => ({
        portfolioId: patch.portfolioId !== undefined ? patch.portfolioId : prev.portfolioId,
        status: patch.status ?? prev.status ?? "all",
        side: patch.side ?? prev.side ?? "all",
        tab: patch.tab ?? prev.tab ?? "orders",
        instructionId:
          patch.instructionId !== undefined ? patch.instructionId : prev.instructionId,
      }),
    });
  }

  return (
    <div className="space-y-6">
      {mode === "unavailable" ? (
        <div
          role="status"
          className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-3 text-[13px] text-[var(--terminal-muted)]"
        >
          Trading is currently unavailable. Existing local order records remain available below.
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-medium tracking-tight">Orders</h1>
          <p className="mt-1 text-[13px] text-[var(--terminal-muted)]">
            {tab === "scheduled"
              ? "Scheduled and recurring market orders"
              : "Open, filled, cancelled, and rejected orders"}
            {selectedPortfolio ? ` for ${selectedPortfolio.name}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedPortfolio && tab === "scheduled" ? (
            <button
              type="button"
              className="rounded-md border border-[var(--terminal-border)] px-3 py-2 text-[12px] min-h-11"
              onClick={() => setScheduleOpen(true)}
            >
              Schedule trade
            </button>
          ) : null}
          <PortfolioSwitcher
            portfolios={portfolios}
            selectedId={selectedPortfolio?.id ?? null}
            eligibleCompanies={eligibleCompanies}
            onSelect={(id) => updateSearch({ portfolioId: id })}
            onCreated={(p) => updateSearch({ portfolioId: p.id })}
          />
        </div>
      </div>

      <div className="flex gap-2">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => updateSearch({ tab: value, instructionId: undefined })}
            className={cn(
              "rounded-md px-3 py-2 text-[12px] capitalize min-h-11",
              tab === value
                ? "bg-[var(--terminal-surface-2)] text-[var(--terminal-text)]"
                : "text-[var(--terminal-muted)]",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === "orders" ? (
        <>
          <div className="flex flex-wrap gap-2">
            <FilterGroup
              label="Status"
              value={status}
              options={["all", "open", "filled", "cancelled", "rejected"]}
              onChange={(v) => updateSearch({ status: v as OrdersStatusFilter })}
            />
            <FilterGroup
              label="Side"
              value={side}
              options={["all", "buy", "sell"]}
              onChange={(v) => updateSearch({ side: v as OrdersSideFilter })}
            />
          </div>

          <OrdersList
            orders={filtered}
            onSelect={setSelected}
            onCancel={
              mode === "unavailable"
                ? undefined
                : (orderId) => {
                    if (!selectedPortfolio) return;
                    void cancelFn({
                      data: { portfolioId: selectedPortfolio.id, orderId },
                    }).then(() => invalidateRouteData(router));
                  }
            }
          />
        </>
      ) : (
        <ScheduledTradesList
          rows={scheduled}
          onSelect={(id) => updateSearch({ instructionId: id })}
          onPause={(id) => void pauseFn({ data: id }).then(() => invalidateRouteData(router))}
          onResume={(id) => void resumeFn({ data: id }).then(() => invalidateRouteData(router))}
          onCancel={(id) => void cancelScheduleFn({ data: id }).then(() => invalidateRouteData(router))}
        />
      )}

      {selectedPortfolio && tab === "scheduled" ? (
        <ScheduleTradeSheet
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          portfolioId={selectedPortfolio.id}
          portfolioName={selectedPortfolio.name}
          symbol="ALTG"
          side="buy"
          allowSymbolEdit
          onCreated={() => invalidateRouteData(router)}
        />
      ) : null}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)]">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {selected.symbol}
                  {selected.instrumentKind === "CRYPTO" ||
                  selected.executionVenue === "ALTA_CRYPTO" ? (
                    <span className="inline-flex rounded-md border border-[var(--terminal-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--terminal-muted)]">
                      Crypto
                    </span>
                  ) : null}
                  <OrderStatusBadge status={selected.status} />
                </DialogTitle>
                <DialogDescription className="text-[var(--terminal-muted)]">
                  {selected.name} · {selected.side}{" "}
                  {selected.instrumentKind === "CRYPTO" ? "market" : selected.type}
                </DialogDescription>
              </DialogHeader>
              {selected.instrumentKind === "CRYPTO" || selected.executionVenue === "ALTA_CRYPTO" ? (
                <dl className="mt-2 grid grid-cols-2 gap-3 text-[13px]">
                  <Detail
                    label="Quantity"
                    value={
                      selected.cryptoSettlement?.executedQuantity ??
                      String(selected.filledQuantity || selected.quantity)
                    }
                  />
                  <Detail
                    label="Avg price"
                    value={
                      selected.cryptoSettlement?.averageExecutionPrice != null ? (
                        <MoneyValue
                          value={Number.parseFloat(selected.cryptoSettlement.averageExecutionPrice)}
                          asPrice
                          size="sm"
                        />
                      ) : selected.averageFillPrice != null ? (
                        <MoneyValue value={selected.averageFillPrice} asPrice size="sm" />
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Detail
                    label="Trade value"
                    value={<MoneyValue value={selected.estimatedValue} size="sm" />}
                  />
                  <Detail
                    label="Crypto trading fee"
                    value={
                      selected.cryptoSettlement?.totalFee != null ? (
                        <MoneyValue
                          value={Number.parseFloat(selected.cryptoSettlement.totalFee)}
                          size="sm"
                        />
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Detail
                    label="Cash impact"
                    value={
                      selected.cryptoSettlement?.customerCashDelta != null ? (
                        <MoneyValue
                          value={Number.parseFloat(selected.cryptoSettlement.customerCashDelta)}
                          signed
                          size="sm"
                        />
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Detail
                    label="Price impact"
                    value={
                      selected.cryptoSettlement?.priceImpactPercent != null
                        ? `${selected.cryptoSettlement.priceImpactPercent}%`
                        : "—"
                    }
                  />
                  {selected.cryptoSettlement?.walletPublicId ? (
                    <Detail
                      label="Wallet"
                      value={
                        <span className="break-all font-mono text-[12px]">
                          {selected.cryptoSettlement.walletPublicId}
                        </span>
                      }
                    />
                  ) : null}
                  <Detail label="Submitted" value={formatActivityDateTime(selected.submittedAt)} />
                </dl>
              ) : (
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
              )}
              {selected.rejectReason ? (
                <p className="mt-3 text-[13px] text-[var(--terminal-red)]">
                  {selected.rejectReason}
                </p>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(search.instructionId && scheduledDetail)}
        onOpenChange={(open) => !open && updateSearch({ instructionId: undefined })}
      >
        <DialogContent className="border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)]">
          {scheduledDetail ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {scheduledDetail.side.toUpperCase()} {scheduledDetail.quantity} {scheduledDetail.symbol}
                </DialogTitle>
                <DialogDescription className="capitalize text-[var(--terminal-muted)]">
                  {scheduledDetail.status} · {scheduledDetail.scheduleType.replace("_", " ")}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <Detail label="Portfolio" value={scheduledDetail.portfolioName} />
                <Detail label="Next run" value={scheduledDetail.nextRunAt ? formatActivityDateTime(scheduledDetail.nextRunAt) : "—"} />
                <Detail label="Start" value={formatActivityDateTime(scheduledDetail.startAt)} />
                {scheduledDetail.scheduleType === "recurring" ? (
                  <Detail
                    label="Frequency"
                    value={scheduledTradeFrequencyLabel(scheduledDetail.frequency)}
                  />
                ) : null}
                <Detail label="Failures" value={String(scheduledDetail.consecutiveFailures)} />
              </dl>
              {scheduledDetail.lastFailureSummary ? (
                <p className="mt-3 text-[13px] text-[var(--terminal-red)]">
                  {scheduledDetail.lastFailureSummary}
                </p>
              ) : null}
              <Link
                to="/terminal/orders/scheduled/$instructionId"
                params={{ instructionId: scheduledDetail.id }}
                className="mt-4 inline-block text-[13px] text-[var(--terminal-accent)]"
              >
                View full detail
              </Link>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScheduledTradesList({
  rows,
  onSelect,
  onPause,
  onResume,
  onCancel,
}: {
  rows: ScheduledTradeInstructionRow[];
  onSelect: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-[var(--terminal-muted)]">
        No scheduled trades yet. Select a portfolio and use Schedule trade to create one.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--terminal-border)] rounded-lg border border-[var(--terminal-border)]">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px]">
          <button type="button" className="text-left" onClick={() => onSelect(row.id)}>
            <div className="font-medium">
              {row.side.toUpperCase()}{" "}
              {row.instrumentKind === "CRYPTO" && row.sizingMode === "FLORIN_AMOUNT"
                ? `ƒ${row.florinAmount ?? row.quantity}`
                : row.quantity}{" "}
              {row.symbol}
              {row.instrumentKind === "CRYPTO" ? (
                <span className="ml-2 inline-flex rounded-md border border-[var(--terminal-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--terminal-muted)]">
                  Crypto
                </span>
              ) : null}
            </div>
            <div className="text-[var(--terminal-muted)] capitalize">
              {row.status} · {row.scheduleType.replace("_", " ")}
              {row.nextRunAt ? ` · Next ${formatActivityDateTime(row.nextRunAt)}` : ""}
            </div>
          </button>
          <div className="flex gap-2">
            {row.status === "active" ? (
              <ActionButton label="Pause" onClick={() => onPause(row.id)} />
            ) : null}
            {row.status === "paused" ? (
              <ActionButton label="Resume" onClick={() => onResume(row.id)} />
            ) : null}
            {["active", "paused"].includes(row.status) ? (
              <ActionButton label="Cancel" onClick={() => onCancel(row.id)} />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-md border border-[var(--terminal-border)] px-2.5 py-1.5 text-[12px] min-h-11"
      onClick={onClick}
    >
      {label}
    </button>
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
            "rounded-md px-2.5 text-[12px] capitalize min-h-11 inline-flex items-center",
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
