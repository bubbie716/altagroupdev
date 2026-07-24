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
import { cn } from "@/lib/utils";
import type { SiteKey } from "@/config/sites";
import {
  getCurrentEcosystemEntry,
  getEcosystemSwitcherLinks,
} from "@/lib/site/ecosystem-config";

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
}: {
  siteKey: SiteKey;
  className?: string;
}) {
  const current = getCurrentEcosystemEntry(siteKey);
  const links = getEcosystemSwitcherLinks(siteKey);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex max-w-[min(100%,14rem)] cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-left text-foreground outline-none transition-colors",
          "hover:bg-surface-2/60 focus-visible:ring-1 focus-visible:ring-gold/40",
          className,
        )}
        aria-label={`Alta ecosystem — currently ${current.name}`}
      >
        <span className="truncate text-[13px] font-medium sm:text-[14px]">{current.name}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[min(calc(100vw-2rem),18rem)] rounded-lg p-1.5 shadow-md"
      >
        <DropdownMenuLabel className="px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
          Alta Ecosystem
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links.map((link) =>
          link.current ? (
            <DropdownMenuItem
              key={link.key}
              disabled
              className="cursor-default items-start rounded-md bg-surface-2/50 px-2 py-2 opacity-100 focus:bg-surface-2/50"
            >
              <EcosystemLinkRow name={link.name} description={link.description} current />
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={link.key} asChild className="cursor-pointer items-start rounded-md px-2 py-2">
              <a href={link.href} className="cursor-pointer no-underline">
                <EcosystemLinkRow name={link.name} description={link.description} current={false} />
              </a>
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
  const links = getEcosystemSwitcherLinks(siteKey);

  return (
    <div className={cn("border-b border-border/60 px-4 py-4", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Alta Ecosystem
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {links.map((link) => (
          <li key={link.key}>
            {link.current ? (
              <div className="flex items-start gap-2 rounded-md bg-surface-2 px-3 py-2.5" aria-current="page">
                <EcosystemLinkRow name={link.name} description={link.description} current />
              </div>
            ) : (
              <a
                href={link.href}
                onClick={onNavigate}
                className="flex cursor-pointer items-start gap-2 rounded-md px-3 py-2.5 text-foreground transition-colors hover:bg-surface-2/60"
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
