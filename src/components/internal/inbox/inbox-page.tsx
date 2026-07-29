"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsEmptyState, OpsStatusBadge, buildBreadcrumbs } from "@/components/internal/console";
import { InboxCaseActions } from "@/components/internal/inbox/inbox-case-actions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { florin } from "@/lib/bank/api";
import {
  categoryLabel,
  formatInboxAge,
  inboxPrimaryActionLabel,
} from "@/lib/internal/inbox-normalize";
import {
  INBOX_CATEGORY_LABELS,
  inboxSearchToParams,
  type InboxCategory,
  type InboxItem,
  type InboxPayload,
  type InboxSearch,
} from "@/lib/internal/inbox-types";
import { cn } from "@/lib/utils";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";

const CATEGORY_ORDER = Object.keys(INBOX_CATEGORY_LABELS) as Array<InboxCategory | "all">;

function hasActiveFilters(search: InboxSearch, query: string): boolean {
  return Boolean(
    (search.category && search.category !== "all") ||
      (search.type && search.type !== "all") ||
      search.status ||
      search.q ||
      query.trim() ||
      (search.sort && search.sort !== "oldest"),
  );
}

export function InboxPage({ payload }: { payload: InboxPayload }) {
  const navigate = useNavigate();
  const router = useRouter();
  const { filtered, summary, search } = payload;
  const [query, setQuery] = useState(search.q ?? "");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(search.caseId ?? null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollRestore = useRef<number | null>(null);
  const caseTriggerRef = useRef<HTMLButtonElement | null>(null);
  /** Sync guard — React state alone races Sheet onOpenChange before navigation commits. */
  const outboundNavRef = useRef(false);

  const selected = useMemo(
    () => (selectedCaseId ? filtered.find((i) => i.id === selectedCaseId) ?? null : null),
    [filtered, selectedCaseId],
  );

  const visibleCategories = useMemo(() => {
    return CATEGORY_ORDER.filter((cat) => {
      if (cat === "all") return true;
      if ((search.category ?? "all") === cat) return true;
      return (summary.byCategory[cat] ?? 0) > 0;
    });
  }, [search.category, summary.byCategory]);

  const hiddenZeroCategories = useMemo(() => {
    return CATEGORY_ORDER.filter(
      (cat) => cat !== "all" && (summary.byCategory[cat] ?? 0) === 0 && (search.category ?? "all") !== cat,
    );
  }, [search.category, summary.byCategory]);

  const filtersActive = hasActiveFilters(search, query);

  useEffect(() => {
    if (!search.caseId && scrollRestore.current != null && listRef.current) {
      listRef.current.scrollTop = scrollRestore.current;
      scrollRestore.current = null;
    }
  }, [search.caseId]);

  useEffect(() => {
    if (search.caseId) setSelectedCaseId(search.caseId);
  }, [search.caseId]);

  function updateSearch(patch: Partial<InboxSearch>) {
    if (Object.prototype.hasOwnProperty.call(patch, "caseId")) {
      setSelectedCaseId(patch.caseId ?? null);
    }
    const next: InboxSearch = { ...search, ...patch };
    void navigate({
      to: "/internal/inbox",
      search: inboxSearchToParams(next),
    });
  }

  function selectCase(item: InboxItem, trigger?: HTMLButtonElement | null) {
    if (listRef.current) scrollRestore.current = listRef.current.scrollTop;
    caseTriggerRef.current = trigger ?? null;
    outboundNavRef.current = false;
    setSelectedCaseId(item.id);
  }

  function clearCase() {
    if (outboundNavRef.current) return;
    setSelectedCaseId(null);
    if (search.caseId) updateSearch({ caseId: undefined });
    queueMicrotask(() => caseTriggerRef.current?.focus());
  }

  /** Synchronous — must run before navigate so sheet close cannot clearCase. */
  function beginOutboundNavigation() {
    outboundNavRef.current = true;
  }

  function clearFilters() {
    setQuery("");
    void navigate({ to: "/internal/inbox", search: withInternalSiteSearch({}, search.site) });
  }

  return (
    <InternalPageShell
      title="Inbox"
      breadcrumbs={buildBreadcrumbs([
        { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
        { label: "Inbox" },
      ])}
    >
      <div
        className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
        aria-label="Inbox priority metrics"
      >
        <Stat label="Open" value={String(summary.total)} />
        <Stat
          label="Oldest"
          value={summary.oldestAgeMs != null ? formatInboxAge(summary.oldestAgeMs) : "—"}
        />
        <Stat label="Over 24h" value={String(summary.olderThan24Hours)} warn={summary.olderThan24Hours > 0} />
        <Stat label="Over 72h" value={String(summary.olderThan72Hours)} warn={summary.olderThan72Hours > 0} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Inbox categories">
        {visibleCategories.map((cat) => {
          const active = (search.category ?? "all") === cat;
          const count = summary.byCategory[cat] ?? 0;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => updateSearch({ category: cat, type: undefined, caseId: undefined })}
              aria-pressed={active}
              className={cn(
                "rounded border px-2.5 py-1 text-[12px] transition-colors",
                active
                  ? "border-gold/40 bg-gold/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {INBOX_CATEGORY_LABELS[cat]}
              <span className="ml-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                {count}
              </span>
            </button>
          );
        })}
        {hiddenZeroCategories.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              aria-expanded={moreFiltersOpen}
              aria-controls="inbox-more-filters"
              onClick={() => setMoreFiltersOpen((v) => !v)}
              className="rounded border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground"
            >
              More filters
            </button>
            {moreFiltersOpen ? (
              <div
                id="inbox-more-filters"
                className="absolute left-0 z-20 mt-1 flex min-w-[10rem] flex-col gap-1 rounded border border-border bg-background p-2 shadow-md"
              >
                {hiddenZeroCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      updateSearch({ category: cat, type: undefined, caseId: undefined });
                      setMoreFiltersOpen(false);
                    }}
                    className="rounded px-2 py-1 text-left text-[12px] text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  >
                    {INBOX_CATEGORY_LABELS[cat]}
                    <span className="ml-1.5 font-mono text-[10px]">0</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateSearch({ q: query || undefined, caseId: undefined });
          }}
          placeholder="Search cases…"
          className="h-8 min-w-[12rem] flex-1 rounded border border-border bg-surface-1 px-2.5 text-[12px] sm:max-w-xs"
          aria-label="Search inbox"
        />
        <select
          value={search.sort ?? "oldest"}
          onChange={(e) =>
            updateSearch({ sort: e.target.value === "newest" ? "newest" : "oldest", caseId: undefined })
          }
          className="h-8 rounded border border-border bg-surface-1 px-2 text-[12px]"
          aria-label="Sort inbox"
        >
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
        </select>
        <details className="relative">
          <summary className="flex h-8 cursor-pointer list-none items-center rounded border border-border px-2.5 text-[12px] text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            Filters
            {search.status ? (
              <span className="ml-1.5 font-mono text-[10px] text-gold">1</span>
            ) : null}
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-52 rounded border border-border bg-background p-2 shadow-md">
            <label className="block text-[11px] text-muted-foreground" htmlFor="inbox-status-filter">
              Status
            </label>
            <select
              id="inbox-status-filter"
              value={search.status ?? ""}
              onChange={(e) =>
                updateSearch({ status: e.target.value || undefined, caseId: undefined })
              }
              className="mt-1 h-8 w-full rounded border border-border bg-surface-1 px-2 text-[12px]"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="needs review">Needs review</option>
              <option value="waiting">Waiting on customer</option>
              <option value="escalated">Escalated</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </details>
        {filtersActive ? (
          <button
            type="button"
            className="h-8 rounded border border-border px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
            onClick={clearFilters}
          >
            Clear
          </button>
        ) : null}
      </div>

      {filtersActive ? (
        <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Active filters">
          {search.category && search.category !== "all" ? (
            <FilterChip
              label={INBOX_CATEGORY_LABELS[search.category]}
              onRemove={() => updateSearch({ category: "all", type: undefined, caseId: undefined })}
            />
          ) : null}
          {search.status ? (
            <FilterChip
              label={search.status}
              onRemove={() => updateSearch({ status: undefined, caseId: undefined })}
            />
          ) : null}
          {search.q ? (
            <FilterChip label={`“${search.q}”`} onRemove={() => updateSearch({ q: undefined, caseId: undefined })} />
          ) : null}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <OpsEmptyState
          title="Inbox is clear"
          description="No open cases match these filters."
        />
      ) : (
        <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div
            ref={listRef}
            className="max-h-[calc(100dvh-16rem)] space-y-2 overflow-y-auto overscroll-contain pr-0.5"
          >
            <ul className="space-y-2 lg:hidden">
              {filtered.map((item) => (
                <li key={item.id}>
                  <InboxCaseCard
                    item={item}
                    selected={selected?.id === item.id}
                    onSelect={(el) => selectCase(item, el)}
                  />
                </li>
              ))}
            </ul>

            <ul className="hidden divide-y divide-border/50 overflow-hidden rounded border border-border/80 bg-surface-1/30 lg:block">
              {filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={(e) => selectCase(item, e.currentTarget)}
                    aria-label={`${item.title}. ${item.partyLabel}. ${item.statusLabel}. Age ${formatInboxAge(item.ageMs)}`}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gold/[0.04]",
                      selected?.id === item.id && "bg-gold/5",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-foreground">{item.title}</span>
                        <OpsStatusBadge status={item.statusLabel} />
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{item.partyLabel}</p>
                      {item.referenceLabel ? (
                        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/80">
                          {item.referenceLabel}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      {item.amount != null ? (
                        <p className="type-finance tabular-nums text-[12px]">{florin(item.amount)}</p>
                      ) : item.amountLabel ? (
                        <p className="type-finance tabular-nums text-[12px]">{item.amountLabel}</p>
                      ) : null}
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {formatInboxAge(item.ageMs)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <aside className="hidden min-h-0 lg:block">
            {selected ? (
              <InboxCaseDetail
                item={selected}
                inboxSearch={search}
                onClose={clearCase}
                onBeginNavigate={beginOutboundNavigation}
                onResolved={() => {
                  clearCase();
                  void router.invalidate();
                }}
              />
            ) : (
              <div className="rounded border border-dashed border-border/70 px-3 py-8 text-center text-[12px] text-muted-foreground">
                Select a case to review evidence and take action.
              </div>
            )}
          </aside>
        </div>
      )}

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && window.matchMedia("(max-width: 1023px)").matches) clearCase();
        }}
      >
        <SheetContent
          side="bottom"
          className="flex max-h-[calc(100dvh-var(--ui-lab-banner-height,0px)-0.5rem)] h-[min(92dvh,40rem)] flex-col gap-0 overflow-hidden p-0 lg:hidden"
          hideCloseButton={false}
        >
          {selected ? (
            <>
              <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-12 text-left">
                <SheetTitle className="text-left text-[15px]">{selected.title}</SheetTitle>
                <SheetDescription className="text-left text-[12px]">
                  {selected.partyLabel} · {selected.statusLabel}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <InboxCaseDetailBody item={selected} />
              </div>
              <div className="sticky bottom-0 shrink-0 border-t border-border/60 bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <InboxCaseActions
                  item={selected}
                  inboxSearch={search}
                  onBeginNavigate={beginOutboundNavigation}
                  onDone={() => {
                    clearCase();
                  }}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </InternalPageShell>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-1 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-border-strong hover:text-foreground"
      aria-label={`Remove filter ${label}`}
    >
      {label}
      <span aria-hidden>×</span>
    </button>
  );
}

function InboxCaseCard({
  item,
  selected,
  onSelect,
}: {
  item: InboxItem;
  selected: boolean;
  onSelect: (el: HTMLButtonElement) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => onSelect(e.currentTarget)}
      aria-label={`${item.title}. ${item.partyLabel}. ${item.statusLabel}. Age ${formatInboxAge(item.ageMs)}`}
      className={cn(
        "w-full rounded border border-border/80 bg-surface-1/40 px-3 py-2.5 text-left",
        selected && "border-gold/40 bg-gold/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-foreground">{item.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{item.partyLabel}</p>
          {item.referenceLabel ? (
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/80">
              {item.referenceLabel}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          {item.amount != null ? (
            <p className="type-finance tabular-nums text-[12px]">{florin(item.amount)}</p>
          ) : null}
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{formatInboxAge(item.ageMs)}</p>
        </div>
      </div>
      <div className="mt-2">
        <OpsStatusBadge status={item.statusLabel} />
      </div>
    </button>
  );
}

function InboxCaseDetail({
  item,
  inboxSearch,
  onClose,
  onBeginNavigate,
  onResolved,
}: {
  item: InboxItem;
  inboxSearch: InboxSearch;
  onClose: () => void;
  onBeginNavigate?: () => void;
  onResolved: () => void;
}) {
  return (
    <div className="sticky top-2 rounded border border-border/80 bg-surface-1/40">
      <div className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{item.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {categoryLabel(item.category)} · {item.partyLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>
      <div className="px-3 py-3">
        <InboxCaseDetailBody item={item} />
      </div>
      <div className="border-t border-border/60 px-3 py-3">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          {inboxPrimaryActionLabel(item)}
        </p>
        <InboxCaseActions
          item={item}
          inboxSearch={inboxSearch}
          onBeginNavigate={onBeginNavigate}
          onDone={onResolved}
        />
      </div>
    </div>
  );
}

function InboxCaseDetailBody({ item }: { item: InboxItem }) {
  return (
    <dl className="grid gap-3 text-[12px]">
      <Field label="Status" value={<OpsStatusBadge status={item.statusLabel} />} />
      <Field
        label="Amount"
        value={
          item.amount != null ? (
            <span className="type-finance tabular-nums">{florin(item.amount)}</span>
          ) : (
            item.amountLabel ?? "—"
          )
        }
      />
      <Field label="Age" value={<span className="font-mono">{formatInboxAge(item.ageMs)}</span>} />
      <Field label="Evidence" value={item.hasProof ? "Proof attached" : "None on file"} />
      {item.referenceLabel ? <Field label="Reference" value={item.referenceLabel} mono /> : null}
      {item.description && item.description !== item.partyLabel ? (
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Notes</dt>
          <dd className="mt-1 text-muted-foreground">{item.description}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-foreground", mono && "font-mono text-[11px]")}>{value}</dd>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded border border-border/70 bg-surface-1/40 px-2.5 py-1.5 sm:px-3 sm:py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[15px] font-semibold tabular-nums sm:mt-1 sm:text-[16px]",
          warn && "text-amber-700 dark:text-amber-300",
        )}
      >
        {value}
      </p>
    </div>
  );
}
