import type { ReactNode } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PortfolioChart } from "@/components/terminal/portfolio-chart";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { AllocationBars, HoldingsTable } from "@/components/terminal/holdings-table";
import { OrdersList } from "@/components/terminal/orders-list";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import {
  CreatePortfolioDialog,
  PortfolioOwnerBadge,
  PortfolioSwitcher,
} from "@/components/terminal/portfolio-switcher";
import {
  archiveTerminalPortfolioFn,
  fetchTerminalPortfolio,
  renameTerminalPortfolioFn,
} from "@/lib/terminal/terminal.functions";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";

export const Route = createFileRoute("/terminal/portfolio/$portfolioId")({
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
  const router = useRouter();
  const renameFn = useServerFn(renameTerminalPortfolioFn);
  const archiveFn = useServerFn(archiveTerminalPortfolioFn);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
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

  if (data.mode === "unavailable") {
    return <TerminalUnavailableState />;
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
        />
      </div>
    );
  }

  const { selectedPortfolio, portfolio, orders, portfolios, eligibleCompanies } = data;
  const empty = portfolio.holdings.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <PortfolioSwitcher
            portfolios={portfolios}
            selectedId={selectedPortfolio.id}
            eligibleCompanies={eligibleCompanies}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] font-medium tracking-tight sm:text-[30px]">
                {selectedPortfolio.name}
              </h1>
              <PortfolioOwnerBadge portfolio={selectedPortfolio} />
            </div>
            <p className="mt-1 text-[13px] text-[var(--terminal-muted)]">
              {selectedPortfolio.ownerLabel}
              {selectedPortfolio.isDefault ? " · Default" : ""}
            </p>
          </div>
        </div>
        {selectedPortfolio.capabilities.canRename || selectedPortfolio.capabilities.canArchive ? (
          <button
            type="button"
            onClick={() => {
              setRenameValue(selectedPortfolio.name);
              setError(null);
              setSettingsOpen(true);
            }}
            className="rounded-md border border-[var(--terminal-border)] px-3 py-2 text-[12px] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]"
          >
            Portfolio settings
          </button>
        ) : null}
      </div>

      <PortfolioChart
        seriesByRange={portfolio.seriesByRange}
        equityValue={portfolio.totalValue}
        dayChange={portfolio.dayChange}
        dayChangePercent={portfolio.dayChangePercent}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Equity" value={<MoneyValue value={portfolio.equityValue} size="md" />} />
        <SummaryCard label="Cash" value={<MoneyValue value={portfolio.cashBalance} size="md" />} />
        <SummaryCard
          label="Buying power"
          value={<MoneyValue value={portfolio.buyingPower} size="md" />}
        />
        <SummaryCard
          label="Day change"
          value={<PriceChange amount={portfolio.dayChange} percent={portfolio.dayChangePercent} />}
        />
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

      <section>
        <h2 className="mb-3 text-[15px] font-medium">Holdings</h2>
        {empty ? (
          <div className="rounded-lg border border-dashed border-[var(--terminal-border)] px-4 py-8">
            <p className="text-[14px] font-medium">No holdings yet</p>
            <p className="mt-1 text-[13px] text-[var(--terminal-muted)]">
              This portfolio has cash but no positions. Browse markets to place an order.
            </p>
          </div>
        ) : (
          <HoldingsTable holdings={portfolio.holdings} portfolioId={selectedPortfolio.id} />
        )}
      </section>

      {!empty ? (
        <section>
          <h2 className="mb-3 text-[15px] font-medium">Allocation</h2>
          <AllocationBars holdings={portfolio.holdings} />
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-[15px] font-medium">Orders & activity</h2>
        <OrdersList orders={orders} />
      </section>

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal
            aria-labelledby="portfolio-settings-title"
            className="w-full max-w-md rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-5 shadow-lg"
          >
            <h2 id="portfolio-settings-title" className="text-[16px] font-medium">
              Portfolio settings
            </h2>
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
                  disabled={busy}
                  className="rounded-md border border-[var(--terminal-red)]/40 px-3 py-2 text-[13px] text-[var(--terminal-red)]"
                  onClick={() => {
                    setBusy(true);
                    void archiveFn({ data: selectedPortfolio.id })
                      .then(() => {
                        setSettingsOpen(false);
                        void router.navigate({ to: "/terminal/portfolio" });
                      })
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : "Archive failed"),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Archive
                </button>
              ) : null}
              {selectedPortfolio.capabilities.canRename ? (
                <button
                  type="button"
                  disabled={busy || !renameValue.trim()}
                  className="rounded-md bg-[var(--terminal-green)] px-3 py-2 text-[13px] font-medium text-black disabled:opacity-50"
                  onClick={() => {
                    setBusy(true);
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
                      .finally(() => setBusy(false));
                  }}
                >
                  Save
                </button>
              ) : null}
            </div>
          </div>
        </div>
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
