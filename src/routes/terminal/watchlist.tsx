import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { WatchlistPanel } from "@/components/terminal/watchlist";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import {
  addTerminalWatchlistSymbol,
  fetchTerminalWatchlist,
  removeTerminalWatchlistSymbol,
} from "@/lib/terminal/terminal.functions";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";

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

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const watched = new Set(watchlist.map((w) => w.symbol));
    return securities
      .filter((s) => !watched.has(s.symbol))
      .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, securities, watchlist]);

  if (mode === "unavailable") {
    return <TerminalUnavailableState />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-medium tracking-tight">Watchlist</h1>
        <p className="mt-1 text-[13px] text-[var(--terminal-muted)]">
          Track securities you care about without opening a position.
        </p>
      </div>

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
                    void addWatch({ data: s.symbol })
                      .then(() => {
                        setQuery("");
                        return invalidateRouteData(router);
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

      <WatchlistPanel
        items={watchlist}
        busySymbol={busy}
        onRemove={(symbol) => {
          setBusy(symbol);
          void removeWatch({ data: symbol })
            .then(() => invalidateRouteData(router))
            .finally(() => setBusy(null));
        }}
      />
    </div>
  );
}
