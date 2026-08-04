import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MarketTable } from "@/components/terminal/market-table";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import { fetchTerminalMarkets } from "@/lib/terminal/terminal.functions";
import { fetchTerminalCryptoMarkets } from "@/lib/terminal/crypto/crypto-market.functions";
import {
  filterSecurities,
  sortSecurities,
  type MarketFilter,
  type MarketSortKey,
} from "@/lib/terminal/market-filters";
import { cn } from "@/lib/utils";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { RoutePendingFallback } from "@/components/ui/route-pending-fallback";

export const Route = createFileRoute("/terminal/markets")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
    filter:
      search.filter === "gainers" || search.filter === "losers" || search.filter === "all"
        ? (search.filter as MarketFilter)
        : ("all" as MarketFilter),
    instrument:
      search.instrument === "crypto" || search.instrument === "stocks"
        ? (search.instrument as "stocks" | "crypto")
        : ("stocks" as const),
  }),
  loaderDeps: ({ search }) => ({ q: search.q, instrument: search.instrument }),
  loader: async ({ deps }) => {
    if (deps.instrument === "crypto") {
      const crypto = await fetchTerminalCryptoMarkets({ data: { heldSymbols: [] } });
      return { kind: "crypto" as const, crypto, stocks: null };
    }
    const stocks = await fetchTerminalMarkets({ data: deps.q || undefined });
    return { kind: "stocks" as const, stocks, crypto: null };
  },
  head: () => ({ meta: [{ title: "Markets — Alta Terminal" }] }),
  pendingComponent: () => <RoutePendingFallback label="Loading markets" />,
  component: TerminalMarketsPage,
});

function TerminalMarketsPage() {
  const data = Route.useLoaderData();
  const { q, filter, instrument } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [sortKey, setSortKey] = useState<MarketSortKey>("dayChangePercent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const demo = isUiLabMode();

  const stockRows = useMemo(() => {
    if (data.kind !== "stocks" || !data.stocks) return [];
    const filtered = filterSecurities(data.stocks.securities, { query: q, filter });
    return sortSecurities(filtered, sortKey, sortDir);
  }, [data, q, filter, sortKey, sortDir]);

  const cryptoAssets = useMemo(() => {
    if (data.kind !== "crypto" || !data.crypto) return [];
    const query = q.trim().toLowerCase();
    return data.crypto.assets.filter((a) => {
      if (!query) return true;
      return (
        a.symbol.toLowerCase().includes(query) ||
        a.displayName.toLowerCase().includes(query)
      );
    });
  }, [data, q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] font-medium tracking-tight">Markets</h1>
        <p className="mt-1 text-[13px] text-[var(--terminal-muted)]">
          Browse instruments available through Alta Terminal.
        </p>
      </div>

      <div className="flex gap-1 rounded-md bg-[var(--terminal-surface)] p-1 w-fit">
        {(
          [
            { id: "stocks" as const, label: "Stocks" },
            { id: "crypto" as const, label: "Crypto" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() =>
              void navigate({
                search: (prev) => ({ ...prev, instrument: tab.id }),
                replace: true,
              })
            }
            className={cn(
              "min-h-11 rounded-md px-4 text-[13px]",
              instrument === tab.id
                ? "bg-[var(--terminal-green)]/15 text-[var(--terminal-green)]"
                : "text-[var(--terminal-muted)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {instrument === "crypto" ? (
        <CryptoMarketsPanel
          available={Boolean(data.crypto?.available)}
          demonstration={Boolean(data.crypto?.demonstration || demo)}
          assets={cryptoAssets}
          q={q}
          onQuery={(value) =>
            void navigate({
              search: (prev) => ({ ...prev, q: value }),
              replace: true,
            })
          }
        />
      ) : data.stocks?.mode === "unavailable" ? (
        <TerminalUnavailableState />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={q}
              onChange={(e) =>
                void navigate({
                  search: (prev) => ({ ...prev, q: e.target.value }),
                  replace: true,
                })
              }
              placeholder="Search symbol or company"
              aria-label="Filter markets"
              className="w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--terminal-green)] sm:max-w-sm"
            />
            <div className="flex gap-1 rounded-md bg-[var(--terminal-surface)] p-1">
              {(["all", "gainers", "losers"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    void navigate({
                      search: (prev) => ({ ...prev, filter: value }),
                      replace: true,
                    })
                  }
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12px] capitalize",
                    filter === value
                      ? "bg-[var(--terminal-green)]/15 text-[var(--terminal-green)]"
                      : "text-[var(--terminal-muted)]",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <MarketTable
            rows={stockRows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(key) => {
              if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
              else {
                setSortKey(key);
                setSortDir(key === "symbol" || key === "name" ? "asc" : "desc");
              }
            }}
          />
        </>
      )}
    </div>
  );
}

function CryptoMarketsPanel({
  available,
  demonstration,
  assets,
  q,
  onQuery,
}: {
  available: boolean;
  demonstration: boolean;
  assets: Array<{
    symbol: string;
    displayName: string;
    statusLabel: string;
    currentPrice: string;
    dayChange: string | null;
    dayChangePercent: string | null;
    noTradesYet: boolean;
  }>;
  q: string;
  onQuery: (value: string) => void;
}) {
  if (!available && !demonstration) {
    return (
      <div className="rounded-lg border border-[var(--terminal-border)] px-4 py-10 text-center">
        <p className="text-[16px] font-medium text-[var(--terminal-text)]">Crypto markets not launched</p>
        <p className="mt-2 text-[13px] text-[var(--terminal-muted)]">
          Fictional Alta Crypto instruments are not available to trade yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {demonstration ? (
        <p className="rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-3 py-2 text-[12px] text-[var(--terminal-muted)]">
          Demonstration data — UI Lab only. Not production market activity.
        </p>
      ) : null}
      <input
        value={q}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search crypto symbol or name"
        aria-label="Filter crypto markets"
        className="w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--terminal-green)] sm:max-w-sm"
      />
      <div className="overflow-hidden rounded-lg border border-[var(--terminal-border)]">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[var(--terminal-surface)] text-[12px] text-[var(--terminal-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Symbol</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium text-right">Price</th>
              <th className="px-3 py-2 font-medium text-right">24h</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.symbol} className="border-t border-[var(--terminal-border)]">
                <td className="px-3 py-3">
                  <Link
                    to="/terminal/security/$symbol"
                    params={{ symbol: asset.symbol }}
                    search={{ range: "1D", portfolioId: undefined, instrument: "crypto" }}
                    className="font-medium text-[var(--terminal-text)] hover:text-[var(--terminal-green)]"
                  >
                    {asset.symbol}
                  </Link>
                </td>
                <td className="px-3 py-3 text-[var(--terminal-muted)]">{asset.displayName}</td>
                <td className="px-3 py-3 text-right">
                  <MoneyValue value={Number(asset.currentPrice)} asPrice cryptoSymbol={asset.symbol} />
                </td>
                <td className="px-3 py-3 text-right">
                  {asset.noTradesYet || asset.dayChangePercent == null ? (
                    <span className="text-[var(--terminal-muted)]" title={asset.noTradesYet ? "No trades yet" : undefined}>
                      —
                    </span>
                  ) : (
                    <PriceChange
                      amount={asset.dayChange == null ? null : Number(asset.dayChange)}
                      percent={Number(asset.dayChangePercent)}
                      cryptoSymbol={asset.symbol}
                    />
                  )}
                </td>
                <td className="px-3 py-3 text-[12px] text-[var(--terminal-muted)]">{asset.statusLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {assets.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-[var(--terminal-muted)]">No crypto assets match.</p>
        ) : null}
      </div>
      <p className="text-[12px] text-[var(--terminal-muted)]">
        Prices are florin prices for fictional Minecraft-economy instruments. No fake movement is shown.
      </p>
    </div>
  );
}
