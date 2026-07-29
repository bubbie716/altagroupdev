"use client";

import type { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { serializeInternalSearch } from "@/lib/internal/normalize-internal-search";

type AnySearch = Record<string, unknown>;

/**
 * URL-backed filter chip that uses aria-pressed only.
 * Uses a plain anchor + router.navigate so TanStack Link cannot inject
 * navigation current-page semantics when the filter destination matches the route.
 */
export function OpsFilterChip({
  to,
  search,
  pressed,
  children,
  className,
}: {
  to: string;
  search: AnySearch;
  pressed: boolean;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const qs = serializeInternalSearch(search);
  const href = qs ? `${to}?${qs}` : to;

  return (
    <a
      href={href}
      aria-pressed={pressed}
      className={cn(
        "rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]",
        pressed
          ? "border-gold/50 bg-gold/10 text-gold"
          : "border-border text-muted-foreground hover:border-border-strong",
        className,
      )}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        void router.navigate({ to: to as "/", search });
      }}
    >
      {children}
    </a>
  );
}
