"use client";

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Moon, Search, Sun, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AuthUserMenu } from "@/components/auth/user-menu";
import { EcosystemSwitcher } from "@/components/site/ecosystem-switcher";
import { MarketStatusBadge } from "@/components/terminal/market-status";
import { SecurityStatusBadge } from "@/components/terminal/market-status";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { searchTerminalSymbols } from "@/lib/terminal/terminal.functions";
import { TERMINAL_PRIMARY_NAV_LINKS } from "@/lib/terminal/terminal-primary-nav";
import type {
  MarketStatusSnapshot,
  SecuritySummary,
  TseDataSourceMode,
} from "@/lib/terminal/types";
import { useSiteContext } from "@/hooks/use-site-context";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme";
import { closeThenRun } from "@/lib/ui/close-then-run";

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function isActive(pathname: string, to: string, exact?: boolean, activePaths?: string[]) {
  const path = normalizePath(pathname);
  if (
    activePaths?.some((p) => path === normalizePath(p) || path.startsWith(`${normalizePath(p)}/`))
  ) {
    return true;
  }
  const target = normalizePath(to);
  if (exact) return path === target;
  if (target === "/terminal") return path === "/terminal";
  return path === target || path.startsWith(`${target}/`);
}

export function UiLabDataBanner({ mode }: { mode: TseDataSourceMode }) {
  if (mode !== "mock") return null;
  return (
    <div
      role="status"
      className="border-b border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-3 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]"
    >
      UI Lab · demonstration data
    </div>
  );
}

export function TerminalUnavailableState({
  title = "Market connection unavailable",
  description = "Market quotes and trading are unavailable because a live Newport TSE connection is not configured.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-5 py-10 text-center">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--terminal-muted)]">
        Alta Terminal
      </p>
      <h1 className="mt-3 text-[22px] font-medium tracking-tight">{title}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--terminal-muted)]">{description}</p>
      <p className="mt-6 text-[12px] text-[var(--terminal-muted)]">
        Order submission is disabled until a live connection is configured.
      </p>
    </div>
  );
}

function useSymbolSearch() {
  const searchFn = useServerFn(searchTerminalSymbols);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SecuritySummary[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchFn({ data: query })
        .then((rows) => setResults(rows.slice(0, 8)))
        .catch(() => setResults([]));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, searchFn]);

  function clear() {
    setQuery("");
    setResults([]);
  }

  return { query, setQuery, results, clear };
}

function SearchResultList({
  results,
  onSelect,
}: {
  results: SecuritySummary[];
  onSelect: (symbol: string) => void;
}) {
  if (results.length === 0) return null;
  return (
    <ul
      className="divide-y divide-[var(--terminal-border)]"
      role="listbox"
      aria-label="Symbol results"
    >
      {results.map((row) => (
        <li key={row.symbol} role="option">
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] hover:bg-[var(--terminal-surface-2)]"
            onClick={() => onSelect(row.symbol)}
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
      ))}
    </ul>
  );
}

export function TerminalTopNav({ marketStatus }: { marketStatus?: MarketStatusSnapshot | null }) {
  const site = useSiteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const search = useSymbolSearch();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const searchLabelId = useId();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (!sheetOpen) return;
    const id = window.requestAnimationFrame(() => sheetInputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [sheetOpen]);

  function closeSearchSurface() {
    setDropdownOpen(false);
    setSheetOpen(false);
    search.clear();
  }

  function selectResult(symbol: string) {
    closeThenRun(closeSearchSurface, () => {
      void navigate({
        to: "/terminal/security/$symbol",
        params: { symbol },
        search: { range: "1D", portfolioId: undefined },
      });
    });
  }

  return (
    <header
      className="sticky z-40 border-b border-[var(--terminal-border)] bg-[var(--terminal-bg)]/95 backdrop-blur-sm"
      style={{ top: "var(--ui-lab-banner-height, 0px)" }}
    >
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <EcosystemSwitcher siteKey={site.key} variant="branded" className="shrink-0" />

        <nav className="ml-1 hidden items-center gap-1 lg:flex" aria-label="Terminal">
          {TERMINAL_PRIMARY_NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.to, link.exact, link.activePaths);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  active
                    ? "text-[var(--terminal-green)]"
                    : "text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]",
                )}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/*
          Both search UIs stay in the SSR tree. CSS toggles at 360px so server
          and client markup match; display:none keeps the inactive control out
          of the accessibility/focus tree.
        */}
        <div className="ml-auto min-[360px]:hidden">
          <button
            ref={searchTriggerRef}
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex size-11 items-center justify-center rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-muted)] transition-colors hover:text-[var(--terminal-text)]"
            aria-label="Search symbols"
          >
            <Search className="size-4" aria-hidden />
          </button>
          <Sheet
            open={sheetOpen}
            onOpenChange={(open) => {
              setSheetOpen(open);
              if (!open) {
                search.clear();
                searchTriggerRef.current?.focus();
              }
            }}
          >
            <SheetContent
              side="top"
              overlayClassName="z-[130] data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=closed]:animate-none"
              className={cn(
                "z-[130] inset-x-0 top-[var(--ui-lab-banner-height,0px)] max-h-[min(92dvh,100dvh)] gap-0 overflow-hidden border-[var(--terminal-border)] bg-[var(--menu-surface)] p-0 text-[var(--terminal-text)]",
                "data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=closed]:animate-none",
              )}
              onOpenAutoFocus={(event) => {
                // Prefer the search field for this surface (typing intent).
                event.preventDefault();
                sheetInputRef.current?.focus();
              }}
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <SheetHeader className="border-b border-[var(--terminal-border)] px-4 py-3 pr-14 text-left">
                <SheetTitle id={searchLabelId} className="text-[16px] font-medium">
                  Search symbols
                </SheetTitle>
                <SheetDescription className="text-[12px] text-[var(--terminal-muted)]">
                  Find a security by ticker or company name.
                </SheetDescription>
              </SheetHeader>
              <div className="px-3 py-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--terminal-muted)]" />
                  <input
                    ref={sheetInputRef}
                    value={search.query}
                    onChange={(e) => search.setQuery(e.target.value)}
                    placeholder="Symbol or company"
                    aria-labelledby={searchLabelId}
                    className="min-h-11 w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] py-2.5 pl-10 pr-10 text-[15px] text-[var(--terminal-text)] outline-none placeholder:text-[var(--terminal-muted)] focus:border-[var(--terminal-green)]"
                  />
                  {search.query ? (
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center text-[var(--terminal-muted)]"
                      aria-label="Clear search"
                      onClick={() => search.clear()}
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="max-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain pb-4">
                <SearchResultList results={search.results} onSelect={selectResult} />
                {search.query.trim() && search.results.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[13px] text-[var(--terminal-muted)]">
                    No symbols match “{search.query.trim()}”.
                  </p>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="relative ml-auto hidden min-w-0 max-w-xs flex-1 min-[360px]:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--terminal-muted)]" />
          <input
            ref={inputRef}
            value={search.query}
            onChange={(e) => {
              search.setQuery(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDropdownOpen(false);
                inputRef.current?.blur();
              }
            }}
            placeholder="Search symbols"
            aria-label="Search symbols"
            className="min-h-11 w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] py-2 pl-8 pr-10 text-[13px] text-[var(--terminal-text)] outline-none placeholder:text-[var(--terminal-muted)] focus:border-[var(--terminal-green)]"
          />
          {search.query ? (
            <button
              type="button"
              className="absolute right-0.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center text-[var(--terminal-muted)]"
              aria-label="Clear search"
              onClick={() => {
                search.clear();
                setDropdownOpen(false);
              }}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          {dropdownOpen && search.results.length > 0 ? (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border border-[var(--terminal-border)] bg-[var(--menu-surface)] shadow-lg">
              <SearchResultList results={search.results} onSelect={selectResult} />
            </div>
          ) : null}
        </div>

        {marketStatus ? (
          <MarketStatusBadge
            status={marketStatus.status}
            label={marketStatus.label}
            className="hidden sm:inline-flex"
          />
        ) : null}
        <button
          type="button"
          onClick={toggle}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-muted)] transition-colors hover:text-[var(--terminal-text)]"
          aria-label={`Switch Terminal to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <AuthUserMenu />
      </div>
    </header>
  );
}

const MOBILE_LINKS = [
  { label: "Home", to: "/terminal", exact: true },
  { label: "Markets", to: "/terminal/markets" },
  { label: "Portfolio", to: "/terminal/portfolio" },
  { label: "Watchlist", to: "/terminal/watchlist" },
  { label: "Orders", to: "/terminal/orders" },
] as const;

export function TerminalMobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--terminal-border)] bg-[var(--terminal-bg)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
      aria-label="Terminal mobile"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_LINKS.map((link) => {
          const active = isActive(pathname, link.to, "exact" in link ? link.exact : false);
          return (
            <li key={link.to}>
              <Link
                to={link.to}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-[10px] tracking-wide",
                  active ? "text-[var(--terminal-green)]" : "text-[var(--terminal-muted)]",
                )}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TerminalAppShell({
  children,
  mode,
  marketStatus,
}: {
  children: React.ReactNode;
  mode: TseDataSourceMode;
  marketStatus?: MarketStatusSnapshot | null;
}) {
  const title = useMemo(() => "Alta Terminal", []);
  return (
    <div className="terminal-shell">
      <UiLabDataBanner mode={mode} />
      <TerminalTopNav marketStatus={marketStatus} />
      <main className="terminal-content">{children}</main>
      <TerminalMobileNav />
      <span className="sr-only">{title}</span>
    </div>
  );
}
