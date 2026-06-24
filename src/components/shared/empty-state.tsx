import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Institutional empty state — used wherever a list, table, or card
 * has no records yet. Replaces ad-hoc "No data" strings.
 *
 * Visual idiom: hairline-bordered slip with a mono tag, serif title,
 * single-paragraph explanation, and optional CTA.
 */
export function EmptyState({
  tag = "No records",
  title,
  description,
  action,
  icon,
  className,
  align = "center",
  size = "default",
}: {
  /** Mono uppercase pill in the corner. */
  tag?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  align?: "center" | "start";
  size?: "compact" | "default";
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-lg border border-dashed border-border bg-surface-1/40",
        align === "center" ? "items-center text-center" : "items-start text-left",
        size === "compact" ? "px-6 py-10" : "px-6 py-14 sm:px-10 sm:py-16",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
        )}
      >
        <span className="size-1 rounded-full bg-gold/70" aria-hidden />
        {tag}
      </div>

      {icon ? (
        <div className="grid size-10 place-items-center rounded-full border border-border bg-surface-1 text-muted-foreground">
          {icon}
        </div>
      ) : null}

      <h3
        className={cn(
          "font-serif tracking-tight",
          size === "compact" ? "text-lg" : "text-xl sm:text-2xl",
        )}
      >
        {title}
      </h3>

      {description ? (
        <p
          className={cn(
            "max-w-md text-[13px] leading-relaxed text-muted-foreground",
            align === "center" ? "mx-auto" : "",
          )}
        >
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}