"use client";

import { Inbox } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSiteContext } from "@/hooks/use-site-context";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { cn } from "@/lib/utils";

/**
 * Operator Inbox shortcut for the internal console header.
 * Replaces the customer notification center — operators must not see public product alerts here.
 */
export function InternalInboxShortcut({ className }: { className?: string }) {
  const site = useSiteContext();
  const to = site.key === "terminal" ? "/internal/terminal/inbox" : "/internal/inbox";

  return (
    <Link
      to={to}
      search={withInternalSiteSearch({}, site.key)}
      aria-label="Open operator inbox"
      title="Open operator inbox"
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center rounded border border-border bg-surface-1 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Inbox className="size-3.5" aria-hidden />
    </Link>
  );
}
