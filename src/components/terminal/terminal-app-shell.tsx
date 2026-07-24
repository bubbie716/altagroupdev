"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Moon, Search, Sun, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AuthUserMenu } from "@/components/auth/user-menu";
import { EcosystemSwitcher } from "@/components/site/ecosystem-switcher";
import { MarketStatusBadge } from "@/components/terminal/market-status";
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

export function MockDataBanner({ mode }: { mode: TseDataSourceMode }) {
  if (mode !== "mock") return null;
  return (
    <div
      role="status"
      className="border-b border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-3 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]"
    >
      Demonstration data · Not live market quotes
    </div>
  );
}

export function TerminalUnavailableState({
  title = "Market connection unavailable",
  description = "Alta Terminal cannot reach the Newport TSE right now. Portfolio browsing stays available when connectivity returns.",
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

export function TerminalTopNav({ marketStatus }: { marketStatus?: MarketStatusSnapshot | null }) {
  const site = useSiteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchFn = useServerFn(searchTerminalSymbols);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SecuritySummary[]>([]);
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();

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

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--terminal-border)] bg-[var(--terminal-bg)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-3 px-3 sm:px-6">
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

        <div className="relative ml-auto min-w-0 flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--terminal-muted)]" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search symbols"
            aria-label="Search symbols"
            className="w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] py-2 pl-8 pr-8 text-[13px] text-[var(--terminal-text)] outline-none placeholder:text-[var(--terminal-muted)] focus:border-[var(--terminal-green)]"
          />
          {query ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--terminal-muted)]"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          {open && results.length > 0 ? (
            <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] shadow-lg">
              {results.map((row) => (
                <li key={row.symbol}>
                  <Link
                    to="/terminal/security/$symbol"
                    params={{ symbol: row.symbol }}
                    search={{ range: "1D" }}
                    className="flex items-center justify-between px-3 py-2.5 text-[13px] hover:bg-[var(--terminal-surface-2)]"
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span>
                      <span className="font-medium">{row.symbol}</span>
                      <span className="ml-2 text-[var(--terminal-muted)]">{row.name}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-muted)] transition-colors hover:text-[var(--terminal-text)]"
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
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] tracking-wide",
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
      <MockDataBanner mode={mode} />
      <TerminalTopNav marketStatus={marketStatus} />
      <main className="terminal-content">{children}</main>
      <TerminalMobileNav />
      <span className="sr-only">{title}</span>
    </div>
  );
}
