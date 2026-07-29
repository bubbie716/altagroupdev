"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { useSiteContext } from "@/hooks/use-site-context";
import { globalOpsSearch } from "@/lib/internal/ops-platform.functions";
import type { GlobalSearchResult } from "@/lib/internal/ops-types";
import {
  groupOpsSearchResults,
  prioritizeTerminalSearchResults,
  visibleGroupResults,
  type SearchResultGroupId,
} from "@/lib/internal/ops-search-groups";
import { parseInternalSearchHref } from "@/lib/internal/navigate-internal-search-href";
import { SEARCH_DEBOUNCE_MS } from "@/lib/ui/route-loading";
import { cn } from "@/lib/utils";

const typeLabels: Record<GlobalSearchResult["type"], string> = {
  user: "Customer",
  company: "Company",
  terminal_portfolio: "Portfolio",
  terminal_order: "Order",
  account: "Bank Account",
  transaction: "Transaction",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  loan: "Loan",
  lending_application: "Lending App",
  statement: "Statement",
  alta_card: "Alta Card",
  alta_card_application: "Card Application",
  alta_card_review: "Card Review",
  alta_card_statement: "Card Statement",
  alta_pay: "Alta Pay",
  deal_room: "Deal Room",
  relationship_profile: "Relationship",
  company_relationship: "Co. Relationship",
  audit: "Audit",
  job_run: "Job Run",
};

function labelForResult(type: GlobalSearchResult["type"], siteKey: string): string {
  if ((siteKey === "terminal" || siteKey === "exchange") && type === "user") return "Investor";
  if ((siteKey === "terminal" || siteKey === "exchange") && type === "company") {
    return "Company investor";
  }
  return typeLabels[type];
}

function searchPlaceholder(siteKey: string): string {
  if (siteKey === "terminal" || siteKey === "exchange") {
    return "Search investors, portfolios, orders…";
  }
  if (siteKey === "bank") {
    return "Search customers, accounts, transactions…";
  }
  return "Search customers, companies, accounts…";
}

export function InternalGlobalSearch({ variant = "page" }: { variant?: "page" | "header" }) {
  const router = useRouter();
  const site = useSiteContext();
  const searchFn = useServerFn(globalOpsSearch);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState<Partial<Record<SearchResultGroupId, boolean>>>({});
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRequestRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const terminalSite = site.key === "terminal" || site.key === "exchange";

  const groups = useMemo(() => {
    if (terminalSite) {
      const ranked = prioritizeTerminalSearchResults(results, q);
      return groupOpsSearchResults(ranked, q).filter(
        (g) => g.id !== "audit" && g.id !== "activity",
      );
    }
    return groupOpsSearchResults(results, q);
  }, [results, q, terminalSite]);

  const flatVisible = useMemo(() => {
    const rows: GlobalSearchResult[] = [];
    for (const group of groups) {
      const { visible } = visibleGroupResults(group, Boolean(expanded[group.id]));
      rows.push(...visible);
    }
    return rows;
  }, [groups, expanded]);

  async function runSearch(value: string, requestId: number) {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      if (requestId === searchRequestRef.current) {
        setResults([]);
      }
      return;
    }
    setPending(true);
    try {
      const rows = await searchFn({ data: { q: trimmed, site: site.key } });
      if (requestId === searchRequestRef.current) {
        setResults(rows);
        setOpen(true);
        setExpanded({});
        setActiveIndex(-1);
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setPending(false);
      }
    }
  }

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const requestId = ++searchRequestRef.current;
    const handle = window.setTimeout(() => {
      void runSearch(trimmed, requestId);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on q/site only
  }, [q, site.key]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatVisible.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && activeIndex >= 0 && flatVisible[activeIndex]) {
        e.preventDefault();
        navigateTo(flatVisible[activeIndex]!);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeIndex, flatVisible, router, site.key]);

  function navigateTo(row: GlobalSearchResult) {
    const dest = parseInternalSearchHref(row.href, site.key);
    setOpen(false);
    setQ("");
    setResults([]);
    if (!dest) return;
    void router.navigate({
      to: dest.to as "/",
      search: dest.search,
      ...(dest.hash ? { hash: dest.hash } : {}),
    });
  }

  const isHeader = variant === "header";
  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={rootRef} className={cn("relative min-w-0 flex-1", !isHeader && "mb-0 w-full")}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 180)}
          placeholder={searchPlaceholder(site.key)}
          aria-label="Global ops search"
          aria-expanded={showPanel}
          aria-controls="internal-global-search-results"
          className={cn(
            "w-full rounded border border-border bg-surface-1 pl-8 pr-2 text-[12px] outline-none focus:border-gold/40",
            isHeader ? "h-8 py-1" : "px-4 py-2.5 text-sm shadow-card",
          )}
        />
        {pending ? (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            …
          </span>
        ) : null}
      </div>
      {showPanel ? (
        <div
          id="internal-global-search-results"
          role="listbox"
          className="absolute z-50 mt-1 max-h-80 w-full min-w-[18rem] overflow-auto rounded border border-border bg-surface-1 shadow-elevated"
        >
          {pending && results.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-muted-foreground">Searching…</p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-muted-foreground">No matches.</p>
          ) : (
            groups.map((group) => {
              const { visible, hiddenCount } = visibleGroupResults(
                group,
                Boolean(expanded[group.id]),
              );
              return (
                <div key={group.id} className="border-b border-border/60 last:border-0">
                  <div className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    {group.label}
                  </div>
                  {visible.map((r) => {
                    const flatIdx = flatVisible.findIndex(
                      (x) => x.type === r.type && x.id === r.id,
                    );
                    const active = flatIdx === activeIndex;
                    return (
                      <button
                        key={`${r.type}-${r.id}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={cn(
                          "flex w-full items-start justify-between gap-3 border-b border-border/40 px-3 py-2.5 text-left last:border-0",
                          active ? "bg-surface-2/70" : "hover:bg-surface-2/50",
                        )}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => navigateTo(r)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-medium">{r.label}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {r.sublabel}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-gold">
                          {labelForResult(r.type, site.key)}
                        </span>
                      </button>
                    );
                  })}
                  {hiddenCount > 0 ? (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-[11px] text-gold hover:underline"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [group.id]: true }))
                      }
                    >
                      View more ({hiddenCount})
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
