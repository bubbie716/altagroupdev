import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { WatchlistPanel } from "@/components/terminal/watchlist";
import {
  addTerminalWatchlistSymbol,
  fetchTerminalWatchlist,
  removeTerminalWatchlistSymbol,
} from "@/lib/terminal/terminal.functions";
import { refreshMutationRouteData } from "@/lib/router/post-mutation-refresh";

export const Route = createFileRoute("/terminal/watchlist")({
  loader: async () => fetchTerminalWatchlist(),
  head: () => ({ meta: [{ title: "Watchlist — Alta Terminal" }] }),
  component: TerminalWatchlistPage,
});

function TerminalWatchlistPage() {
  const { mode, watchlist, securities } = Route.useLoaderData();
  const router = useRouter();
  const addWatch = useServerFn(addTerminalWatchlistSymbol);
  const removeWatch = useServerFn(removeTerminalWatchlistSymbol);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const marketDirectoryAvailable = mode !== "unavailable" && securities.length > 0;

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !marketDirectoryAvailable) return [];
    const watched = new Set(watchlist.map((w) => w.symbol));
    return securities
      .filter((s) => !watched.has(s.symbol))
      .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, securities, watchlist, marketDirectoryAvailable]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-medium tracking-tight">Watchlist</h1>
        <p className="mt-1 text-[13px] text-[var(--terminal-muted)]">
          Track securities you care about without opening a position.
        </p>
      </div>

      {!marketDirectoryAvailable ? (
        <div
          role="status"
          className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-3 text-[13px] text-[var(--terminal-muted)]"
        >
          Market quotes are unavailable. Existing symbols stay listed without prices. New symbols
          cannot be added until the market directory is connected.
        </div>
      ) : null}

      {marketDirectoryAvailable ? (
        <div className="relative max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add symbol or company"
            aria-label="Add to watchlist"
            className="w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--terminal-green)]"
          />
          {suggestions.length > 0 ? (
            <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)]">
              {suggestions.map((s) => (
                <li key={s.symbol}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] hover:bg-[var(--terminal-surface-2)]"
                    onClick={() => {
                      setBusy(s.symbol);
                      setError(null);
                      void addWatch({ data: s.symbol })
                        .then(() => {
                          setQuery("");
                          return refreshMutationRouteData(router, "terminal");
                        })
                        .catch((err: unknown) => {
                          setError(err instanceof Error ? err.message : "Could not add symbol");
                        })
                        .finally(() => setBusy(null));
                    }}
                  >
                    <span>
                      <span className="font-medium">{s.symbol}</span>
                      <span className="ml-2 text-[var(--terminal-muted)]">{s.name}</span>
                    </span>
                    <span className="text-[var(--terminal-green)]">Add</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-[13px] text-red-500">{error}</p> : null}

      {watchlist.length === 0 ? (
        <div className="rounded-lg border border-[var(--terminal-border)] px-4 py-8">
          <h2 className="text-[16px] font-medium">Your watchlist is empty</h2>
          <p className="mt-2 max-w-xl text-[13px] text-[var(--terminal-muted)]">
            {marketDirectoryAvailable
              ? "Add symbols from Markets when you want to keep an eye on them."
              : "Once the market directory is available, you can add symbols here."}
          </p>
        </div>
      ) : (
        <WatchlistPanel
          items={watchlist}
          busySymbol={busy}
          onRemove={(symbol) => {
            setBusy(symbol);
            void removeWatch({ data: symbol })
              .then(() => refreshMutationRouteData(router, "terminal"))
              .finally(() => setBusy(null));
          }}
        />
      )}
    </div>
  );
}
