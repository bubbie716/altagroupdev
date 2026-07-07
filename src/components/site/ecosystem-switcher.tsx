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

type EcosystemSwitcherVariant = "default" | "ncc";

function triggerLabel(siteKey: SiteKey, variant: EcosystemSwitcherVariant): string {
  const entry = getCurrentEcosystemEntry(siteKey);
  return variant === "ncc" ? entry.shortName : entry.name;
}

function EcosystemLinkRow({
  name,
  description,
  current,
  variant,
}: {
  name: string;
  description: string;
  current: boolean;
  variant: EcosystemSwitcherVariant;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        {current ? (
          <Check
            className={cn("size-3.5", variant === "ncc" ? "text-[#0c4d32]" : "text-gold")}
            aria-hidden
          />
        ) : null}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate text-[13px] leading-tight",
            current
              ? variant === "ncc"
                ? "font-medium text-[#0c4d32]"
                : "font-medium text-foreground"
              : variant === "ncc"
                ? "text-[#111827]"
                : "text-foreground",
          )}
        >
          {name}
        </span>
        <span
          className={cn(
            "mt-0.5 block truncate text-[11px] leading-snug",
            variant === "ncc" ? "text-[#6b7280]" : "text-muted-foreground",
          )}
        >
          {description}
        </span>
      </span>
    </div>
  );
}

export function EcosystemSwitcher({
  siteKey,
  variant = "default",
  className,
}: {
  siteKey: SiteKey;
  variant?: EcosystemSwitcherVariant;
  className?: string;
}) {
  const current = getCurrentEcosystemEntry(siteKey);
  const links = getEcosystemSwitcherLinks(siteKey);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex max-w-[min(100%,14rem)] cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-left outline-none transition-colors",
          "focus-visible:ring-1 focus-visible:ring-gold/40",
          variant === "ncc"
            ? "text-[#111827] hover:bg-[#f9fafb]"
            : "text-foreground hover:bg-surface-2/60",
          className,
        )}
        aria-label={`Alta ecosystem — currently ${current.name}`}
      >
        <span className="truncate text-[13px] font-medium sm:text-[14px]">
          {triggerLabel(siteKey, variant)}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 opacity-60",
            variant === "ncc" ? "text-[#6b7280]" : "text-muted-foreground",
          )}
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(
          "w-[min(calc(100vw-2rem),18rem)] rounded-lg p-1.5 shadow-md",
          variant === "ncc" && "border-[#e5e7eb] bg-white text-[#111827]",
        )}
      >
        <DropdownMenuLabel
          className={cn(
            "px-2 py-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.18em]",
            variant === "ncc" ? "text-[#6b7280]" : "text-muted-foreground",
          )}
        >
          Alta Ecosystem
        </DropdownMenuLabel>
        <DropdownMenuSeparator className={variant === "ncc" ? "bg-[#e5e7eb]" : undefined} />
        {links.map((link) =>
          link.current ? (
            <DropdownMenuItem
              key={link.key}
              disabled
              className={cn(
                "cursor-default items-start rounded-md px-2 py-2 opacity-100",
                variant === "ncc" ? "bg-[#e8f2ed]/60 focus:bg-[#e8f2ed]/60" : "bg-surface-2/50 focus:bg-surface-2/50",
              )}
            >
              <EcosystemLinkRow
                name={link.name}
                description={link.description}
                current
                variant={variant}
              />
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={link.key} asChild className="cursor-pointer items-start rounded-md px-2 py-2">
              <a href={link.href} className="cursor-pointer no-underline">
                <EcosystemLinkRow
                  name={link.name}
                  description={link.description}
                  current={false}
                  variant={variant}
                />
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
  variant = "default",
  onNavigate,
  className,
}: {
  siteKey: SiteKey;
  variant?: EcosystemSwitcherVariant;
  onNavigate?: () => void;
  className?: string;
}) {
  const links = getEcosystemSwitcherLinks(siteKey);

  return (
    <div
      className={cn(
        "border-b px-4 py-4",
        variant === "ncc" ? "border-[#e5e7eb]" : "border-border/60",
        className,
      )}
    >
      <p
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.18em]",
          variant === "ncc" ? "text-[#6b7280]" : "text-muted-foreground",
        )}
      >
        Alta Ecosystem
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {links.map((link) => (
          <li key={link.key}>
            {link.current ? (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-md px-3 py-2.5",
                  variant === "ncc" ? "bg-[#e8f2ed]/70" : "bg-surface-2",
                )}
                aria-current="page"
              >
                <EcosystemLinkRow
                  name={link.name}
                  description={link.description}
                  current
                  variant={variant}
                />
              </div>
            ) : (
              <a
                href={link.href}
                onClick={onNavigate}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md px-3 py-2.5 transition-colors",
                  variant === "ncc"
                    ? "text-[#111827] hover:bg-[#f9fafb]"
                    : "text-foreground hover:bg-surface-2/60",
                )}
              >
                <EcosystemLinkRow
                  name={link.name}
                  description={link.description}
                  current={false}
                  variant={variant}
                />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
