"use client";

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useControlledMenu } from "@/hooks/use-controlled-menu";
import { createTerminalPortfolioFn } from "@/lib/terminal/terminal.functions";
import type { TerminalPortfolioSummary } from "@/lib/terminal/types";
import { cn } from "@/lib/utils";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";

type EligibleCompany = { id: string; name: string; ticker: string | null };

const DEFAULT_CREATE_NAME = "New portfolio";

/**
 * Survives portfolio-detail remounts (`key={selectedPortfolio.id}`) so focus can
 * return to the heading trigger after navigation settles. Stores the target id so
 * the pre-navigation instance does not steal/clear the pending focus.
 */
let pendingHeadingFocusId: string | null = null;

export function PortfolioSwitcher({
  portfolios,
  selectedId,
  eligibleCompanies = [],
  onCreated,
  onSelect,
  className,
  compact = false,
  variant = "default",
}: {
  portfolios: TerminalPortfolioSummary[];
  selectedId: string | null;
  eligibleCompanies?: EligibleCompany[];
  /**
   * Called exactly once after a successful create.
   * When provided, the parent owns navigation — this component will not navigate.
   * When omitted, navigates to the new portfolio detail route.
   */
  onCreated?: (portfolio: TerminalPortfolioSummary) => void;
  /** Override default navigation when selecting an existing portfolio. */
  onSelect?: (portfolioId: string) => void;
  className?: string;
  compact?: boolean;
  /** `heading` = page-title trigger (portfolio detail). `default` = bordered control. */
  variant?: "default" | "heading";
}) {
  const navigate = useNavigate();
  const isRoutePending = useRouterState({ select: (s) => s.status === "pending" });
  const menu = useControlledMenu();
  const [createOpen, setCreateOpen] = useState(false);
  /** Optimistic label while a switch/create navigation is in flight. */
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const selected = portfolios.find((p) => p.id === selectedId) ?? null;
  const displayName = pendingLabel ?? selected?.name ?? "Select portfolio";
  const ownerLine = selected
    ? selected.ownerType === "personal"
      ? "Personal"
      : selected.ownerLabel
    : "—";
  const displayOwner = pendingLabel ? "Switching…" : ownerLine;

  useEffect(() => {
    if (!isRoutePending) setPendingLabel(null);
  }, [isRoutePending, selectedId]);

  useEffect(() => {
    if (variant !== "heading") return;
    if (!pendingHeadingFocusId || pendingHeadingFocusId !== selectedId) return;
    if (isRoutePending) return;

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (cancelled || pendingHeadingFocusId !== selectedId) return;
        const el = triggerRef.current;
        if (!el?.isConnected) return;
        pendingHeadingFocusId = null;
        el.focus({ preventScroll: true });
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [variant, selectedId, isRoutePending, displayName]);

  const personal = useMemo(
    () => portfolios.filter((p) => p.ownerType === "personal"),
    [portfolios],
  );
  const company = useMemo(
    () => portfolios.filter((p) => p.ownerType === "company"),
    [portfolios],
  );

  function selectPortfolio(id: string, label?: string) {
    if (menu.isNavigating()) return;
    const name = label ?? portfolios.find((p) => p.id === id)?.name ?? null;
    if (name) setPendingLabel(name);
    if (variant === "heading") pendingHeadingFocusId = id;
    menu.runAfterClose(() => {
      if (onSelect) {
        onSelect(id);
        return;
      }
      void navigate({
        to: "/terminal/portfolio/$portfolioId",
        params: { portfolioId: id },
        search: { range: "1D" },
      });
    });
  }

  function handleCreated(portfolio: TerminalPortfolioSummary) {
    setPendingLabel(portfolio.name);
    if (variant === "heading") pendingHeadingFocusId = portfolio.id;
    // Parent owns navigation when onCreated is provided — never also call onSelect/goToPortfolio.
    if (onCreated) {
      onCreated(portfolio);
      return;
    }
    void navigate({
      to: "/terminal/portfolio/$portfolioId",
      params: { portfolioId: portfolio.id },
      search: { range: "1D" },
    });
  }

  const ariaOwnerLine = ownerLine.trim().replace(/[.!?]+$/, "");
  const ariaLabel = selected
    ? variant === "heading"
      ? `Current portfolio: ${selected.name} · ${ariaOwnerLine}. Change portfolio.`
      : `Portfolio switcher — currently ${selected.name}`
    : variant === "heading"
      ? "Choose a portfolio"
      : "Portfolio switcher — no portfolio selected";

  return (
    <>
      <DropdownMenu open={menu.open} onOpenChange={menu.setOpen}>
        <DropdownMenuTrigger asChild>
          {variant === "heading" ? (
            <button
              ref={triggerRef}
              type="button"
              className={cn(
                "group -mx-1 max-w-full rounded-md px-1 py-1 text-left outline-none transition-colors",
                "min-h-11 hover:bg-[var(--menu-item-hover)]/50",
                "focus-visible:ring-1 focus-visible:ring-[var(--terminal-green)]/40",
                className,
              )}
              aria-label={ariaLabel}
            >
              <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <h1 className="min-w-0 truncate text-[26px] font-medium leading-[1.3] tracking-tight text-[var(--terminal-text)] sm:text-[30px]">
                  {displayName}
                </h1>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-[var(--terminal-muted)] transition-transform duration-200 sm:size-6",
                    menu.open && "rotate-180",
                  )}
                  aria-hidden
                />
              </span>
              <span className="mt-0.5 block truncate text-[13px] leading-snug text-[var(--terminal-muted)]">
                {displayOwner}
              </span>
            </button>
          ) : (
            <button
              ref={triggerRef}
              type="button"
              className={cn(
                "inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-2.5 text-left outline-none",
                "hover:bg-[var(--menu-item-hover)] focus-visible:ring-1 focus-visible:ring-[var(--terminal-green)]/40",
                compact ? "py-1.5" : "py-2",
                className,
              )}
              aria-label={ariaLabel}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-[var(--terminal-text)]">
                  {displayName}
                </span>
                {!compact ? (
                  <span className="block truncate text-[11px] text-[var(--terminal-muted)]">
                    {displayOwner}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-[var(--terminal-muted)] transition-transform duration-200",
                  menu.open && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[min(calc(100vw-2rem),18rem)] rounded-lg border-[var(--terminal-border)] bg-[var(--menu-surface)] p-1.5 text-[var(--terminal-text)]"
          onCloseAutoFocus={(event) => {
            // While navigating away, skip restoring the soon-to-unmount trigger;
            // the heading variant refocuses the new page trigger after settle.
            if (menu.isNavigating()) {
              event.preventDefault();
              return;
            }
            if (variant === "heading") {
              event.preventDefault();
              triggerRef.current?.focus({ preventScroll: true });
            }
          }}
        >
          {personal.length > 0 ? (
            <>
              <DropdownMenuLabel className="px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-[var(--terminal-muted)]">
                Personal
              </DropdownMenuLabel>
              {personal.map((p) => (
                <PortfolioMenuItem
                  key={p.id}
                  portfolio={p}
                  current={p.id === selectedId}
                  onSelect={() => selectPortfolio(p.id, p.name)}
                />
              ))}
            </>
          ) : null}
          {company.length > 0 ? (
            <>
              <DropdownMenuSeparator className="bg-[var(--terminal-border)]" />
              <DropdownMenuLabel className="px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-[var(--terminal-muted)]">
                Companies
              </DropdownMenuLabel>
              {company.map((p) => (
                <PortfolioMenuItem
                  key={p.id}
                  portfolio={p}
                  current={p.id === selectedId}
                  onSelect={() => selectPortfolio(p.id, p.name)}
                />
              ))}
            </>
          ) : null}
          {portfolios.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-[var(--terminal-muted)]">
              No portfolios yet. Create one to get started.
            </p>
          ) : null}
          <DropdownMenuSeparator className="bg-[var(--terminal-border)]" />
          <DropdownMenuItem
            className="cursor-pointer gap-2 rounded-md px-2 py-2 text-[13px]"
            onSelect={() => {
              menu.close();
              setCreateOpen(true);
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            Create portfolio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreatePortfolioDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        eligibleCompanies={eligibleCompanies}
        onCreated={handleCreated}
      />
    </>
  );
}

function PortfolioMenuItem({
  portfolio,
  current,
  onSelect,
}: {
  portfolio: TerminalPortfolioSummary;
  current: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      className={cn(
        "cursor-pointer items-start rounded-md px-2 py-2",
        current && "bg-[var(--menu-item-selected)]",
      )}
      onSelect={() => {
        // Do not preventDefault — that keeps Radix menus open.
        onSelect();
      }}
    >
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        {current ? <Check className="size-3.5 text-[var(--terminal-green)]" aria-hidden /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-[var(--terminal-text)]">{portfolio.name}</span>
        <span className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-[var(--terminal-muted)]">
          <span className="truncate">{portfolio.ownerLabel}</span>
          <MoneyValue value={portfolio.totalValue} size="sm" className="shrink-0" />
        </span>
      </span>
    </DropdownMenuItem>
  );
}

export function CreatePortfolioDialog({
  open,
  onOpenChange,
  eligibleCompanies,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eligibleCompanies: EligibleCompany[];
  onCreated?: (portfolio: TerminalPortfolioSummary) => void;
}) {
  const createFn = useServerFn(createTerminalPortfolioFn);
  const [name, setName] = useState(DEFAULT_CREATE_NAME);
  const [ownerType, setOwnerType] = useState<"personal" | "company">("personal");
  const [companyId, setCompanyId] = useState(eligibleCompanies[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const portfolioNameId = useId();
  const companySelectId = useId();
  const submitGuard = useRef(false);
  const shouldResetRef = useRef(false);

  function resetForm() {
    setName(DEFAULT_CREATE_NAME);
    setOwnerType("personal");
    setCompanyId(eligibleCompanies[0]?.id ?? "");
    setError(null);
    setSucceeded(false);
    submitGuard.current = false;
  }

  function handleOpenChange(next: boolean) {
    if (busy && !next) return;
    if (!next && shouldResetRef.current) {
      // Defer reset until after the close animation so the form does not flash.
      window.setTimeout(() => {
        resetForm();
        shouldResetRef.current = false;
      }, 200);
    }
    onOpenChange(next);
  }

  async function handleCreate() {
    if (busy || submitGuard.current || succeeded) return;
    submitGuard.current = true;
    setBusy(true);
    setError(null);
    try {
      const created = await createFn({
        data: {
          name,
          ownerType,
          ownerCompanyId: ownerType === "company" ? companyId : null,
        },
      });
      setSucceeded(true);
      shouldResetRef.current = true;
      onCreated?.(created);
      onOpenChange(false);
    } catch (err) {
      submitGuard.current = false;
      setError(err instanceof Error ? err.message : "Could not create portfolio");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="border-[var(--terminal-border)] bg-[var(--menu-surface)] sm:max-w-md"
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          if (succeeded) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Create portfolio</DialogTitle>
          <DialogDescription className="text-[var(--terminal-muted)]">
            Personal portfolios belong to you. Company portfolios use your Alta company membership.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <label htmlFor={portfolioNameId} className="block space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]">
              Name
            </span>
            <input
              id={portfolioNameId}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--terminal-green)] disabled:opacity-60"
            />
          </label>

          <fieldset className="space-y-2" disabled={busy}>
            <legend className="text-[11px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]">
              Owner
            </legend>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="radio"
                name="owner"
                checked={ownerType === "personal"}
                onChange={() => setOwnerType("personal")}
              />
              Personal
            </label>
            <label
              className={cn(
                "flex items-center gap-2 text-[13px]",
                eligibleCompanies.length === 0 && "opacity-50",
              )}
            >
              <input
                type="radio"
                name="owner"
                checked={ownerType === "company"}
                disabled={eligibleCompanies.length === 0}
                onChange={() => setOwnerType("company")}
              />
              Company
            </label>
            {ownerType === "company" && eligibleCompanies.length > 0 ? (
              <div>
                <label
                  htmlFor={companySelectId}
                  className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]"
                >
                  Company account
                </label>
                <select
                  id={companySelectId}
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2 text-[13px]"
                >
                  {eligibleCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.ticker ? ` (${c.ticker})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {eligibleCompanies.length === 0 ? (
              <p className="text-[12px] text-[var(--terminal-muted)]">
                No companies you can represent for Terminal portfolios.
              </p>
            ) : null}
          </fieldset>

          {error ? (
            <p role="alert" className="text-[13px] text-[var(--terminal-red)]">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <button
            type="button"
            disabled={busy}
            className="rounded-md px-3 py-2 text-[13px] text-[var(--terminal-muted)] disabled:opacity-50"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || succeeded || !name.trim() || (ownerType === "company" && !companyId)}
            onClick={() => void handleCreate()}
            className="rounded-md bg-[var(--terminal-green)] px-4 py-2 text-[13px] font-medium text-black disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PortfolioOwnerBadge({
  portfolio,
  decorative = false,
}: {
  portfolio: Pick<TerminalPortfolioSummary, "ownerType" | "ownerLabel">;
  decorative?: boolean;
}) {
  return (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px]",
        portfolio.ownerType === "company"
          ? "border-[var(--terminal-green)]/30 text-[var(--terminal-green)]"
          : "border-[var(--terminal-border)] text-[var(--terminal-muted)]",
      )}
    >
      {portfolio.ownerType === "company" ? portfolio.ownerLabel : "Personal"}
    </span>
  );
}

export function HomePortfolioCard({ portfolio }: { portfolio: TerminalPortfolioSummary }) {
  const showValuation = portfolio.valuationAvailable && portfolio.totalValue != null;
  return (
    <Link
      to="/terminal/portfolio/$portfolioId"
      params={{ portfolioId: portfolio.id }}
      search={{ range: "1D" }}
      className="block rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-3 transition-colors hover:border-[var(--terminal-green)]/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">{portfolio.name}</p>
          <p className="mt-0.5 text-[11px] text-[var(--terminal-muted)]">{portfolio.ownerLabel}</p>
        </div>
        <PortfolioOwnerBadge portfolio={portfolio} decorative />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        {showValuation ? (
          <>
            <MoneyValue value={portfolio.totalValue} size="md" />
            <PriceChange amount={portfolio.dayChange} percent={portfolio.dayChangePercent} />
          </>
        ) : (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--terminal-muted)]">
                Cash
              </p>
              <MoneyValue value={portfolio.cashBalance ?? 0} size="md" />
            </div>
            <span className="text-[11px] text-[var(--terminal-muted)]">Valuation unavailable</span>
          </>
        )}
      </div>
    </Link>
  );
}
