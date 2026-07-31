import type { ReactNode } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Settings2 } from "lucide-react";
import { PortfolioChart } from "@/components/terminal/portfolio-chart";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { AllocationBars, HoldingsTable } from "@/components/terminal/holdings-table";
import { CryptoHoldingsTable } from "@/components/terminal/crypto-holdings-table";
import { WalletDetailsSheet } from "@/components/terminal/wallet-details-sheet";
import { OrdersList } from "@/components/terminal/orders-list";
import { ActivityList } from "@/components/terminal/activity-list";
import { CreatePortfolioDialog, PortfolioSwitcher } from "@/components/terminal/portfolio-switcher";
import { RoutePendingFallback } from "@/components/ui/route-pending-fallback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  archiveTerminalPortfolioFn,
  fetchTerminalPortfolio,
  renameTerminalPortfolioFn,
} from "@/lib/terminal/terminal.functions";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";
import type { TerminalChartRange } from "@/lib/terminal/types";
import type { CryptoPortfolioSummary } from "@/lib/terminal/crypto/crypto-market-read.service";
import { buildPortfolioAllocation } from "@/lib/terminal/crypto/portfolio-allocation";

export const Route = createFileRoute("/terminal/portfolio/$portfolioId")({
  validateSearch: (search: Record<string, unknown>) => ({
    range:
      typeof search.range === "string" &&
      ["1D", "1W", "1M", "3M", "1Y", "ALL"].includes(search.range)
        ? (search.range as TerminalChartRange)
        : ("1D" as TerminalChartRange),
  }),
  loader: async ({ params }) => {
    if (params.portfolioId === "new") {
      const data = await fetchTerminalPortfolio({ data: {} });
      return { ...data, onboarding: true as const };
    }
    return {
      ...(await fetchTerminalPortfolio({ data: { portfolioId: params.portfolioId } })),
      onboarding: false as const,
    };
  },
  pendingComponent: () => <RoutePendingFallback label="Loading portfolio" />,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.selectedPortfolio
          ? `${loaderData.selectedPortfolio.name} — Alta Terminal`
          : "Portfolio — Alta Terminal",
      },
    ],
  }),
  component: TerminalPortfolioDetailPage,
});

function TerminalPortfolioDetailPage() {
  const data = Route.useLoaderData();
  const { range } = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate();
  const renameFn = useServerFn(renameTerminalPortfolioFn);
  const archiveFn = useServerFn(archiveTerminalPortfolioFn);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState<"rename" | "archive" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (data.portfolioUnavailable) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--terminal-muted)]">
          Portfolio unavailable
        </p>
        <h1 className="mt-2 text-[26px] font-medium tracking-tight">
          We couldn&apos;t open that portfolio
        </h1>
        <p className="mt-3 text-[14px] text-[var(--terminal-muted)]">
          It may have been archived, deleted, or belong to an account you cannot access.
        </p>
        <Link
          to="/terminal/portfolio"
          className="mt-6 inline-flex rounded-md bg-[var(--terminal-green)] px-4 py-2.5 text-[13px] font-medium text-black"
        >
          Return to portfolios
        </Link>
      </div>
    );
  }

  if (data.onboarding || !data.selectedPortfolio || !data.portfolio) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-10 text-center">
        <h1 className="text-[24px] font-medium tracking-tight">Set up a portfolio</h1>
        <p className="text-[14px] text-[var(--terminal-muted)]">
          Create a personal or company portfolio to track cash, holdings, and orders.
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex rounded-md bg-[var(--terminal-green)] px-4 py-2.5 text-[13px] font-medium text-black"
        >
          Create portfolio
        </button>
        <CreatePortfolioDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          eligibleCompanies={data.eligibleCompanies}
          onCreated={(p) => {
            void navigate({
              to: "/terminal/portfolio/$portfolioId",
              params: { portfolioId: p.id },
              search: { range: "1D" },
            });
          }}
        />
      </div>
    );
  }

  const { selectedPortfolio, portfolio, orders, activity, portfolios, eligibleCompanies } = data;
  const crypto = (data as { crypto?: CryptoPortfolioSummary | null }).crypto ?? null;
  const cryptoBalances = crypto?.balances ?? [];
  const hasStockHoldings = portfolio.holdings.length > 0;
  const hasCryptoHoldings = cryptoBalances.length > 0;
  const empty = !hasStockHoldings && !hasCryptoHoldings;
  const showWallet = Boolean(crypto?.hasWallet && crypto.walletPublicId);
  const allocation = buildPortfolioAllocation({
    holdings: portfolio.holdings,
    cryptoBalances,
  });
  const showAllocation =
    !empty &&
    allocation != null &&
    (portfolio.valuationAvailable || hasCryptoHoldings);

  return (
    <div className="space-y-8" key={selectedPortfolio.id}>
      {!portfolio.valuationAvailable ? (
        <div
          role="status"
          className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-3 text-[13px] text-[var(--terminal-muted)]"
        >
          Markets and trading are currently offline. Portfolio value reflects available cash
          {hasCryptoHoldings ? " plus marked crypto balances" : ""}; stock holdings, orders, and
          activity are from your local portfolio records. Crypto chart history uses fills and
          persisted prices only — never invented pre-launch holdings.
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <PortfolioSwitcher
            variant="heading"
            portfolios={portfolios}
            selectedId={selectedPortfolio.id}
            eligibleCompanies={eligibleCompanies}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showWallet ? (
            <button
              type="button"
              onClick={() => setWalletOpen(true)}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--terminal-border)] px-3 text-[12px] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]"
            >
              Wallet
            </button>
          ) : null}
          {selectedPortfolio.capabilities.canTrade ? (
            <Link
              to="/terminal/orders"
              search={{ tab: "scheduled", portfolioId: selectedPortfolio.id }}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--terminal-border)] px-3 text-[12px] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]"
            >
              Schedule trade
            </Link>
          ) : null}
          {selectedPortfolio.capabilities.canRename || selectedPortfolio.capabilities.canArchive ? (
          <button
            type="button"
            onClick={() => {
              setRenameValue(selectedPortfolio.name);
              setError(null);
              setSettingsOpen(true);
            }}
            className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--terminal-border)] text-[12px] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)] sm:h-11 sm:w-auto sm:px-3"
            aria-label="Portfolio settings"
            title="Portfolio settings"
          >
            <Settings2 className="size-4 sm:hidden" aria-hidden />
            <span className="hidden sm:inline">Portfolio settings</span>
          </button>
          ) : null}
        </div>
      </div>

      <PortfolioChart
        seriesByRange={portfolio.seriesByRange}
        equityValue={portfolio.totalValue}
        dayChange={portfolio.dayChange}
        dayChangePercent={portfolio.dayChangePercent}
        valuationAvailable={portfolio.valuationAvailable}
        range={range}
        onRangeChange={(next) => {
          void navigate({
            to: "/terminal/portfolio/$portfolioId",
            params: { portfolioId: selectedPortfolio.id },
            search: (prev) => ({ ...prev, range: next }),
            replace: true,
            resetScroll: false,
          });
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Equity"
          value={<MoneyValue value={portfolio.equityValue} size="md" />}
        />
        <SummaryCard
          label="Cash"
          value={<MoneyValue value={portfolio.cashBalance} size="md" animateOnChange />}
        />
        <SummaryCard
          label="Buying power"
          value={<MoneyValue value={portfolio.buyingPower} size="md" animateOnChange />}
        />
        <SummaryCard
          label="Day change"
          value={<PriceChange amount={portfolio.dayChange} percent={portfolio.dayChangePercent} />}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/bank"
          search={{ action: "terminal-funding", portfolioId: selectedPortfolio.id }}
          className="inline-flex min-h-11 items-center rounded-md border border-[var(--terminal-border)] px-3.5 py-2 text-[13px] text-[var(--terminal-text)] hover:border-[var(--terminal-green)]/40"
        >
          Transfer money
        </Link>
        <p className="self-center text-[12px] text-[var(--terminal-muted)]">
          Move florins between Alta Bank and this portfolio’s cash.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard
          label="Total return"
          value={
            <PriceChange amount={portfolio.totalReturn} percent={portfolio.totalReturnPercent} />
          }
        />
        <SummaryCard
          label="Unrealized"
          value={
            <PriceChange
              amount={portfolio.unrealizedReturn}
              percent={portfolio.unrealizedReturnPercent}
            />
          }
        />
      </div>

      <section className="space-y-6">
        <h2 className="text-[15px] font-medium">Holdings</h2>
        {empty ? (
          <div className="rounded-lg border border-dashed border-[var(--terminal-border)] px-4 py-8">
            <p className="text-[14px] font-medium">No holdings yet</p>
            <p className="mt-1 text-[13px] text-[var(--terminal-muted)]">
              This portfolio has cash but no positions. Browse markets to place an order.
            </p>
          </div>
        ) : (
          <>
            {hasStockHoldings ? (
              <div>
                {hasCryptoHoldings ? (
                  <h3 className="mb-2 text-[12px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]">
                    Stocks
                  </h3>
                ) : null}
                <HoldingsTable holdings={portfolio.holdings} portfolioId={selectedPortfolio.id} />
              </div>
            ) : null}
            {hasCryptoHoldings ? (
              <div>
                {hasStockHoldings ? (
                  <h3 className="mb-2 text-[12px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]">
                    Crypto
                  </h3>
                ) : null}
                <CryptoHoldingsTable
                  balances={cryptoBalances}
                  portfolioId={selectedPortfolio.id}
                />
              </div>
            ) : null}
          </>
        )}
      </section>

      {showAllocation && allocation ? (
        <section>
          <h2 className="mb-1 text-[15px] font-medium">Allocation</h2>
          <AllocationBars
            rows={allocation.rows}
            basisDescription={allocation.basisDescription}
          />
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-medium">Orders</h2>
          <Link
            to="/terminal/orders"
            search={{ portfolioId: selectedPortfolio.id, status: "all", side: "all" }}
            className="text-[12px] text-[var(--terminal-muted)] hover:text-[var(--terminal-green)]"
          >
            View all
          </Link>
        </div>
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--terminal-border)] px-4 py-8 text-center">
            <p className="text-[14px] font-medium">No orders yet</p>
            <p className="mt-1 text-[13px] text-[var(--terminal-muted)]">
              Place a trade from Markets to see order history here.
            </p>
          </div>
        ) : (
          <OrdersList orders={orders} />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-medium">Activity</h2>
        <ActivityList
          activity={activity ?? []}
          emptyMessage="Deposits, fills, dividends, and fees will appear here."
        />
      </section>

      <Dialog
        open={settingsOpen}
        modal
        onOpenChange={(next) => {
          if (!next && busy === null) setSettingsOpen(false);
        }}
      >
        <DialogContent
          className="w-full max-w-md border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-5 text-[var(--terminal-text)]"
          onEscapeKeyDown={(event) => {
            if (busy !== null) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy !== null) event.preventDefault();
          }}
        >
          <DialogHeader className="text-left">
            <DialogTitle id="portfolio-settings-title" className="text-[16px] font-medium">
              Portfolio settings
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[var(--terminal-muted)]">
              Rename or archive this Terminal portfolio.
            </DialogDescription>
          </DialogHeader>
            {selectedPortfolio.capabilities.canRename ? (
              <label htmlFor="terminal-portfolio-name" className="mt-4 block space-y-1.5">
                <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]">
                  Name
                </span>
                <input
                  id="terminal-portfolio-name"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--terminal-green)]"
                />
              </label>
            ) : null}
            {error ? <p className="mt-3 text-[13px] text-[var(--terminal-red)]">{error}</p> : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-2 text-[13px] text-[var(--terminal-muted)]"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
              {selectedPortfolio.capabilities.canArchive ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  className="rounded-md border border-[var(--terminal-red)]/40 px-3 py-2 text-[13px] text-[var(--terminal-red)] disabled:opacity-50"
                  onClick={() => {
                    setBusy("archive");
                    void archiveFn({ data: selectedPortfolio.id })
                      .then(() => {
                        setSettingsOpen(false);
                        void router.navigate({ to: "/terminal/portfolio" });
                      })
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : "Archive failed"),
                      )
                      .finally(() => setBusy(null));
                  }}
                >
                  {busy === "archive" ? "Archiving…" : "Archive"}
                </button>
              ) : null}
              {selectedPortfolio.capabilities.canRename ? (
                <button
                  type="button"
                  disabled={busy !== null || !renameValue.trim()}
                  className="rounded-md bg-[var(--terminal-green)] px-3 py-2 text-[13px] font-medium text-black disabled:opacity-50"
                  onClick={() => {
                    setBusy("rename");
                    void renameFn({
                      data: { portfolioId: selectedPortfolio.id, name: renameValue },
                    })
                      .then(() => {
                        setSettingsOpen(false);
                        return invalidateRouteData(router);
                      })
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : "Rename failed"),
                      )
                      .finally(() => setBusy(null));
                  }}
                >
                  {busy === "rename" ? "Saving…" : "Save"}
                </button>
              ) : null}
            </div>
        </DialogContent>
      </Dialog>

      {showWallet && crypto?.walletPublicId ? (
        <WalletDetailsSheet
          open={walletOpen}
          onOpenChange={setWalletOpen}
          publicWalletId={crypto.walletPublicId}
          walletStatus={crypto.walletStatus}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]">
        {label}
      </p>
      <div className="mt-2">{value}</div>
    </div>
  );
}
