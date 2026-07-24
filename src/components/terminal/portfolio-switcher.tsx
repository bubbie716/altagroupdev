"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useMemo, useState } from "react";
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
import { createTerminalPortfolioFn } from "@/lib/terminal/terminal.functions";
import type { TerminalPortfolioSummary } from "@/lib/terminal/types";
import { cn } from "@/lib/utils";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";

type EligibleCompany = { id: string; name: string; ticker: string | null };

export function PortfolioSwitcher({
  portfolios,
  selectedId,
  eligibleCompanies = [],
  onCreated,
  onSelect,
  className,
  compact = false,
}: {
  portfolios: TerminalPortfolioSummary[];
  selectedId: string | null;
  eligibleCompanies?: EligibleCompany[];
  onCreated?: (portfolio: TerminalPortfolioSummary) => void;
  /** Override default navigation to portfolio detail. */
  onSelect?: (portfolioId: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const selected = portfolios.find((p) => p.id === selectedId) ?? null;

  const personal = useMemo(
    () => portfolios.filter((p) => p.ownerType === "personal"),
    [portfolios],
  );
  const company = useMemo(
    () => portfolios.filter((p) => p.ownerType === "company"),
    [portfolios],
  );

  function goToPortfolio(id: string) {
    if (onSelect) {
      onSelect(id);
      return;
    }
    void navigate({ to: "/terminal/portfolio/$portfolioId", params: { portfolioId: id } });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-2.5 py-1.5 text-left outline-none",
            "hover:bg-[var(--terminal-surface-2)] focus-visible:ring-1 focus-visible:ring-[var(--terminal-green)]/40",
            className,
          )}
          aria-label={
            selected
              ? `Portfolio switcher — currently ${selected.name}`
              : "Portfolio switcher — no portfolio selected"
          }
        >
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-[var(--terminal-text)]">
              {selected?.name ?? "Select portfolio"}
            </span>
            {!compact ? (
              <span className="block truncate text-[11px] text-[var(--terminal-muted)]">
                {selected?.ownerLabel ?? "—"}
              </span>
            ) : null}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-[var(--terminal-muted)]" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[min(calc(100vw-2rem),18rem)] rounded-lg border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-1.5"
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
                  onSelect={() => goToPortfolio(p.id)}
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
                  onSelect={() => goToPortfolio(p.id)}
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
            onSelect={() => setCreateOpen(true)}
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
        onCreated={(portfolio) => {
          setCreateOpen(false);
          onCreated?.(portfolio);
          goToPortfolio(portfolio.id);
        }}
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
        current && "bg-[var(--terminal-surface-2)]",
      )}
      onSelect={onSelect}
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
  const [name, setName] = useState("New portfolio");
  const [ownerType, setOwnerType] = useState<"personal" | "company">("personal");
  const [companyId, setCompanyId] = useState(eligibleCompanies[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portfolioNameId = useId();
  const companySelectId = useId();

  async function handleCreate() {
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
      onCreated?.(created);
      onOpenChange(false);
      setName("New portfolio");
      setOwnerType("personal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create portfolio");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[var(--terminal-border)] bg-[var(--terminal-surface)] sm:max-w-md">
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
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--terminal-green)]"
            />
          </label>

          <fieldset className="space-y-2">
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

          {error ? <p className="text-[13px] text-[var(--terminal-red)]">{error}</p> : null}
        </div>

        <DialogFooter>
          <button
            type="button"
            className="rounded-md px-3 py-2 text-[13px] text-[var(--terminal-muted)]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !name.trim() || (ownerType === "company" && !companyId)}
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
  return (
    <Link
      to="/terminal/portfolio/$portfolioId"
      params={{ portfolioId: portfolio.id }}
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
        <MoneyValue value={portfolio.totalValue} size="md" />
        <PriceChange amount={portfolio.dayChange} percent={portfolio.dayChangePercent} />
      </div>
    </Link>
  );
}
