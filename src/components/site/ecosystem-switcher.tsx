"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AltaLogo } from "@/components/alta-logo";
import { useControlledMenu } from "@/hooks/use-controlled-menu";
import { cn } from "@/lib/utils";
import type { SiteKey } from "@/config/sites";
import {
  getCurrentEcosystemEntry,
  getEcosystemSwitcherLinks,
} from "@/lib/site/ecosystem-config";
import { readRequestHost } from "@/lib/site/site-context";

function EcosystemLinkRow({
  name,
  description,
  current,
}: {
  name: string;
  description: string;
  current: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        {current ? <Check className="size-3.5 text-gold" aria-hidden /> : null}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate text-[13px] leading-tight",
            current ? "font-medium text-foreground" : "text-foreground",
          )}
        >
          {name}
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </div>
  );
}

export function EcosystemSwitcher({
  siteKey,
  className,
  variant = "text",
}: {
  siteKey: SiteKey;
  className?: string;
  /** `branded` = logo + product name + chevron (Terminal header). */
  variant?: "text" | "branded";
}) {
  const current = getCurrentEcosystemEntry(siteKey);
  const links = getEcosystemSwitcherLinks(siteKey, readRequestHost());
  const isTerminal = siteKey === "terminal";
  const menu = useControlledMenu();

  return (
    <DropdownMenu open={menu.open} onOpenChange={menu.setOpen}>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-md text-left outline-none transition-colors",
          "focus-visible:ring-1 focus-visible:ring-gold/40",
          variant === "branded"
            ? "max-w-[min(100%,16rem)] px-1 py-1 hover:bg-[var(--menu-item-hover)] focus-visible:ring-[var(--terminal-green)]/40"
            : "max-w-[min(100%,14rem)] px-1.5 py-1 hover:bg-[var(--menu-item-hover)]",
          className,
        )}
        aria-label={`Alta ecosystem — currently ${current.name}`}
      >
        {variant === "branded" ? (
          <>
            <AltaLogo className="h-6 w-6 shrink-0" />
            <span className="hidden truncate text-[13px] font-medium tracking-tight text-[var(--terminal-text)] sm:inline">
              {current.name}
            </span>
            <ChevronDown
              className="size-3.5 shrink-0 text-[var(--terminal-muted)] opacity-70"
              aria-hidden
            />
          </>
        ) : (
          <>
            <span className="truncate text-[13px] font-medium sm:text-[14px]">{current.name}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground opacity-60" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(
          "w-[min(calc(100vw-2rem),18rem)] rounded-lg bg-[var(--menu-surface)] p-1.5 shadow-md",
          isTerminal &&
            "border-[var(--terminal-border)] text-[var(--terminal-text)]",
        )}
        onCloseAutoFocus={(event) => {
          if (menu.isNavigating()) event.preventDefault();
        }}
      >
        <DropdownMenuLabel
          className={cn(
            "px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.18em]",
            isTerminal ? "text-[var(--terminal-muted)]" : "text-muted-foreground",
          )}
        >
          Alta Ecosystem
        </DropdownMenuLabel>
        <DropdownMenuSeparator className={isTerminal ? "bg-[var(--terminal-border)]" : undefined} />
        {links.map((link) =>
          link.current ? (
            isTerminal && link.key === "terminal" ? (
              <DropdownMenuItem
                key={link.key}
                className="cursor-pointer items-start rounded-md bg-[var(--menu-item-selected)] px-2 py-2"
                onSelect={() => {
                  menu.close();
                }}
              >
                <EcosystemLinkRow name={link.name} description={link.description} current />
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                key={link.key}
                disabled
                className={cn(
                  "cursor-default items-start rounded-md px-2 py-2 opacity-100",
                  "bg-[var(--menu-item-selected)] focus:bg-[var(--menu-item-selected)]",
                )}
              >
                <EcosystemLinkRow name={link.name} description={link.description} current />
              </DropdownMenuItem>
            )
          ) : (
            <DropdownMenuItem
              key={link.key}
              className="cursor-pointer items-start rounded-md px-2 py-2"
              onSelect={() => {
                if (menu.isNavigating()) return;
                menu.runAfterClose(() => {
                  window.location.assign(link.href);
                });
              }}
            >
              <EcosystemLinkRow name={link.name} description={link.description} current={false} />
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Flat ecosystem list for mobile drawers. */
export function EcosystemSwitcherMobileSection({
  siteKey,
  onNavigate,
  className,
}: {
  siteKey: SiteKey;
  onNavigate?: () => void;
  className?: string;
}) {
  const links = getEcosystemSwitcherLinks(siteKey, readRequestHost());

  return (
    <div className={cn("border-b border-border/60 px-4 py-4", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Alta Ecosystem
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {links.map((link) => (
          <li key={link.key}>
            {link.current ? (
              <div
                className="flex items-start gap-2 rounded-md bg-[var(--menu-item-selected)] px-3 py-2.5"
                aria-current="page"
              >
                <EcosystemLinkRow name={link.name} description={link.description} current />
              </div>
            ) : (
              <a
                href={link.href}
                onClick={onNavigate}
                className="flex cursor-pointer items-start gap-2 rounded-md px-3 py-2.5 text-foreground transition-colors hover:bg-[var(--menu-item-hover)]"
              >
                <EcosystemLinkRow name={link.name} description={link.description} current={false} />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
