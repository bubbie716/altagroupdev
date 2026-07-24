import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MarketTable } from "@/components/terminal/market-table";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import { fetchTerminalMarkets } from "@/lib/terminal/terminal.functions";
import {
  filterSecurities,
  sortSecurities,
  type MarketFilter,
  type MarketSortKey,
} from "@/lib/terminal/market-filters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/terminal/markets")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
    filter:
      search.filter === "gainers" || search.filter === "losers" || search.filter === "all"
        ? (search.filter as MarketFilter)
        : ("all" as MarketFilter),
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => fetchTerminalMarkets({ data: deps.q || undefined }),
  head: () => ({ meta: [{ title: "Markets — Alta Terminal" }] }),
  component: TerminalMarketsPage,
});

function TerminalMarketsPage() {
  const { mode, securities } = Route.useLoaderData();
  const { q, filter } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [sortKey, setSortKey] = useState<MarketSortKey>("dayChangePercent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const filtered = filterSecurities(securities, { query: q, filter });
    return sortSecurities(filtered, sortKey, sortDir);
  }, [securities, q, filter, sortKey, sortDir]);

  if (mode === "unavailable") {
    return <TerminalUnavailableState />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] font-medium tracking-tight">Markets</h1>
        <p className="mt-1 text-[13px] text-[var(--terminal-muted)]">
          Browse securities available through Alta Terminal.
        </p>
      </div>

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
        rows={rows}
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
    </div>
  );
}
