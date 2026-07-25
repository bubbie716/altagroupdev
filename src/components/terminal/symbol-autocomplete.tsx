"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { SecurityStatusBadge } from "@/components/terminal/market-status";
import { useSymbolSearch } from "@/hooks/use-symbol-search";
import type { SecuritySummary } from "@/lib/terminal/types";
import { cn } from "@/lib/utils";

/**
 * Keyboard-accessible ticker autocomplete for Quick Trade.
 * Selection only via known results — free-typed unknown tickers are rejected.
 */
export function SymbolAutocomplete({
  selected,
  onSelect,
  onClear,
  disabled = false,
  className,
}: {
  selected: Pick<SecuritySummary, "symbol" | "name"> | null;
  onSelect: (row: SecuritySummary) => void;
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const search = useSymbolSearch();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [unknownError, setUnknownError] = useState<string | null>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [search.results]);

  function commit(row: SecuritySummary) {
    setUnknownError(null);
    search.clear();
    setOpen(false);
    onSelect(row);
  }

  function clearSelection() {
    setUnknownError(null);
    search.clear();
    setOpen(false);
    onClear();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function tryCommitTyped() {
    const q = search.query.trim().toUpperCase();
    if (!q) return;
    const exact = search.results.find((r) => r.symbol.toUpperCase() === q);
    if (exact) {
      commit(exact);
      return;
    }
    if (search.results.length === 1) {
      commit(search.results[0]!);
      return;
    }
    setUnknownError(`Unknown ticker “${search.query.trim()}”`);
    setOpen(true);
  }

  if (selected) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <p className="text-[12px] text-[var(--terminal-muted)]">Security</p>
        <div className="flex min-h-11 items-center gap-2 rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[var(--terminal-text)]">
              {selected.symbol}
            </p>
            <p className="truncate text-[12px] text-[var(--terminal-muted)]">{selected.name}</p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={clearSelection}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]"
            aria-label="Change security"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  const showList = open && search.query.trim().length > 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-[12px] text-[var(--terminal-muted)]" htmlFor={listId + "-input"}>
        Ticker
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--terminal-muted)]"
          aria-hidden
        />
        <input
          id={listId + "-input"}
          ref={inputRef}
          type="text"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={search.query}
          placeholder="Symbol or company"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && search.results[activeIndex]
              ? `${listId}-opt-${search.results[activeIndex]!.symbol}`
              : undefined
          }
          onChange={(e) => {
            setUnknownError(null);
            search.setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Allow option mousedown to fire first.
            window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              search.clear();
              setOpen(false);
              setUnknownError(null);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) =>
                search.results.length === 0 ? 0 : Math.min(i + 1, search.results.length - 1),
              );
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              const row = search.results[activeIndex];
              if (row) {
                commit(row);
              } else {
                tryCommitTyped();
              }
            }
          }}
          className="min-h-11 w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] py-2.5 pl-10 pr-10 text-[15px] text-[var(--terminal-text)] outline-none placeholder:text-[var(--terminal-muted)] focus:border-[var(--terminal-green)]"
        />
        {search.query ? (
          <button
            type="button"
            className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center text-[var(--terminal-muted)]"
            aria-label="Clear ticker search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              search.clear();
              setUnknownError(null);
            }}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}

        {showList ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching securities"
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-56 overflow-y-auto overscroll-contain rounded-md border border-[var(--terminal-border)] bg-[var(--menu-surface)] shadow-lg"
          >
            {search.results.length === 0 ? (
              <li className="px-3 py-4 text-center text-[13px] text-[var(--terminal-muted)]">
                No symbols match “{search.query.trim()}”.
              </li>
            ) : (
              search.results.map((row, index) => (
                <li key={row.symbol} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    id={`${listId}-opt-${row.symbol}`}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left text-[13px]",
                      index === activeIndex
                        ? "bg-[var(--menu-item-selected)]"
                        : "hover:bg-[var(--menu-item-hover)]",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(row)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[var(--terminal-text)]">{row.symbol}</span>
                        <SecurityStatusBadge status={row.tradingStatus} />
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-[var(--terminal-muted)]">
                        {row.name}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {unknownError ? (
        <p className="text-[12px] text-[var(--terminal-red)]" role="alert">
          {unknownError}
        </p>
      ) : null}
    </div>
  );
}
