import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type InternalBreadcrumbItem = {
  label: string;
  to?: string;
};

export function InternalBreadcrumbs({
  items,
  className,
}: {
  items: InternalBreadcrumbItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" aria-hidden />
            ) : null}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "truncate font-mono text-[10px] uppercase tracking-[0.12em]",
                  isLast ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/** Build breadcrumbs from an explicit trail; last segment is current page (no link). */
export function buildBreadcrumbs(
  segments: Array<{ label: string; to?: string }>,
): InternalBreadcrumbItem[] {
  return segments.map((segment, index) => ({
    label: segment.label,
    to: index < segments.length - 1 ? segment.to : undefined,
  }));
}
