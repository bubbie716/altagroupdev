"use client";

import type { ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyValue } from "@/components/terminal/money-value";
import {
  formatPortfolioOwnerLine,
  groupSecurityPortfolios,
  tradeBlockReason,
  type SecurityPortfolioOption,
} from "@/lib/terminal/security-portfolio-picker";
import { focusDialogCloseButton } from "@/lib/ui/focus-dialog-close";
import { cn } from "@/lib/utils";

export function SecurityPortfolioTrigger({
  label,
  onClick,
  compact = false,
  className,
}: {
  label: string | null;
  onClick: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] text-left outline-none transition-colors",
        "hover:bg-[var(--menu-item-hover)] focus-visible:ring-1 focus-visible:ring-[var(--terminal-green)]/40",
        "active:bg-[var(--menu-item-selected)]",
        compact ? "min-h-11 px-2.5 py-2" : "min-h-11 px-3 py-2.5",
        className,
      )}
      aria-haspopup="dialog"
      aria-label={
        label
          ? `Trading portfolio: ${label}. Change portfolio.`
          : "Choose a portfolio for this order"
      }
    >
      <span className="min-w-0 flex-1">
        {!compact ? (
          <span className="block text-[11px] uppercase tracking-[0.12em] text-[var(--terminal-muted)]">
            Trading from
          </span>
        ) : (
          <span className="block text-[10px] text-[var(--terminal-muted)]">Trading from</span>
        )}
        <span
          className={cn(
            "mt-0.5 block truncate font-medium",
            compact ? "text-[12px]" : "text-[13px]",
            label ? "text-[var(--terminal-text)]" : "text-[var(--terminal-red)]",
          )}
        >
          {label ?? "Choose a portfolio"}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-[var(--terminal-muted)] transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}

/**
 * Single Dialog tree for SSR/client parity.
 * On narrow viewports CSS repositions it as a bottom sheet above the Terminal chrome.
 */
export function SecurityPortfolioPicker({
  open,
  onOpenChange,
  portfolios,
  selectedId,
  securitySymbol,
  onSelect,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolios: SecurityPortfolioOption[];
  selectedId: string | null;
  securitySymbol: string;
  onSelect: (portfolioId: string) => void;
  /** Restore focus to the control that opened the picker (Radix close-autofocus). */
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const { personal, company } = groupSecurityPortfolios(portfolios);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "z-[135] gap-0 border-[var(--terminal-border)] bg-[var(--menu-surface)] p-0 text-[var(--terminal-text)]",
          "data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=closed]:animate-none",
          // Desktop: centered modal
          "sm:max-w-md",
          // Mobile: bottom sheet above nav (SSR-safe — no matchMedia branch)
          "max-lg:left-0 max-lg:right-0 max-lg:top-auto max-lg:bottom-[calc(3.25rem+env(safe-area-inset-bottom,0px))] max-lg:max-h-[min(78dvh,calc(100dvh-7.5rem))] max-lg:w-full max-lg:max-w-none max-lg:translate-x-0 max-lg:translate-y-0 max-lg:rounded-t-xl max-lg:rounded-b-none",
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusDialogCloseButton(event.currentTarget);
        }}
        onCloseAutoFocus={(event) => {
          // Parent restores focus to the opener; prevent Radix default which can
          // land on the wrong nested-dialog layer.
          event.preventDefault();
          onCloseAutoFocus?.(event);
        }}
      >
        <DialogHeader className="border-b border-[var(--terminal-border)] px-4 py-3 pr-14 text-left sm:px-5 sm:py-4">
          <DialogTitle className="text-[16px] font-medium">Choose portfolio</DialogTitle>
          <DialogDescription className="text-[12px] text-[var(--terminal-muted)]">
            Orders for {securitySymbol} use the selected portfolio’s buying power and holdings.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(70dvh,28rem)] overflow-y-auto overscroll-contain px-2 py-2 max-lg:max-h-[min(60dvh,24rem)]">
          <PortfolioPickerBody
            personal={personal}
            company={company}
            selectedId={selectedId}
            securitySymbol={securitySymbol}
            onSelect={onSelect}
            onManage={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PortfolioPickerBody({
  personal,
  company,
  selectedId,
  securitySymbol,
  onSelect,
  onManage,
}: {
  personal: SecurityPortfolioOption[];
  company: SecurityPortfolioOption[];
  selectedId: string | null;
  securitySymbol: string;
  onSelect: (id: string) => void;
  onManage: () => void;
}) {
  return (
    <div className="space-y-3">
      {personal.length > 0 ? (
        <PickerGroup title="Personal">
          {personal.map((portfolio) => (
            <PortfolioOptionButton
              key={portfolio.id}
              portfolio={portfolio}
              selected={portfolio.id === selectedId}
              securitySymbol={securitySymbol}
              onSelect={onSelect}
            />
          ))}
        </PickerGroup>
      ) : null}
      {company.length > 0 ? (
        <PickerGroup title="Companies">
          {company.map((portfolio) => (
            <PortfolioOptionButton
              key={portfolio.id}
              portfolio={portfolio}
              selected={portfolio.id === selectedId}
              securitySymbol={securitySymbol}
              onSelect={onSelect}
            />
          ))}
        </PickerGroup>
      ) : null}
      {personal.length === 0 && company.length === 0 ? (
        <p className="px-3 py-6 text-center text-[13px] text-[var(--terminal-muted)]">
          No portfolios available. Create one from the Portfolio page.
        </p>
      ) : null}
      <div className="border-t border-[var(--terminal-border)] px-2 pt-2">
        <Link
          to="/terminal/portfolio"
          onClick={onManage}
          className="flex min-h-11 w-full items-center justify-center rounded-md px-3 text-[13px] text-[var(--terminal-muted)] transition-colors hover:bg-[var(--menu-item-hover)] hover:text-[var(--terminal-text)]"
        >
          Manage portfolios
        </Link>
      </div>
    </div>
  );
}

function PickerGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--terminal-muted)]">
        {title}
      </p>
      <ul className="space-y-1" role="listbox" aria-label={title}>
        {children}
      </ul>
    </div>
  );
}

function PortfolioOptionButton({
  portfolio,
  selected,
  securitySymbol,
  onSelect,
}: {
  portfolio: SecurityPortfolioOption;
  selected: boolean;
  securitySymbol: string;
  onSelect: (id: string) => void;
}) {
  const blocked = tradeBlockReason(portfolio);
  const disabled = Boolean(blocked);
  const owner = formatPortfolioOwnerLine(portfolio);

  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          onSelect(portfolio.id);
        }}
        className={cn(
          "flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left outline-none transition-colors",
          "hover:bg-[var(--menu-item-hover)] focus-visible:ring-1 focus-visible:ring-[var(--terminal-green)]/40",
          selected && "bg-[var(--menu-item-selected)]",
          disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
        )}
      >
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
          {selected ? <Check className="size-3.5 text-[var(--terminal-green)]" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-[var(--terminal-text)]">
                {portfolio.name}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-[var(--terminal-muted)]">
                {owner}
              </span>
            </span>
            <MoneyValue value={portfolio.totalValue} size="sm" className="shrink-0" />
          </span>
          <span className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-[var(--terminal-muted)]">
            <span>Buying power</span>
            <MoneyValue value={portfolio.buyingPower} size="sm" className="shrink-0" />
          </span>
          {portfolio.holdingQuantity > 0 ? (
            <span className="mt-1 block text-[11px] text-[var(--terminal-muted)]">
              Holds {portfolio.holdingQuantity} {securitySymbol}
            </span>
          ) : null}
          {blocked ? (
            <span className="mt-1 block text-[11px] text-[var(--terminal-red)]">{blocked}</span>
          ) : null}
        </span>
        <span className="sr-only">
          {selected ? "Selected. " : ""}
          {owner}. Total value {portfolio.totalValue}. Buying power {portfolio.buyingPower}.
          {blocked ? ` ${blocked}.` : ""}
        </span>
      </button>
    </li>
  );
}
