import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Institutional empty state. Used as the building block for every "no X yet"
 * surface across Bank, Exchange, Terminal, Companies and Internal. The visual
 * language is intentionally restrained: a hairline-ringed surface, a gold
 * eyebrow for the division/product, a tight title, a single muted paragraph,
 * and at most two actions.
 */
type EmptyStateAction = {
  label: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
};

export type EmptyStateProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** Up to two actions. First defaults to primary. */
  actions?: EmptyStateAction[];
  /** Optional decorative icon, rendered inside a hairline tile. */
  icon?: ReactNode;
  /** Compact variant fits inside dashboard tiles. */
  compact?: boolean;
  className?: string;
  children?: ReactNode;
};

const primary =
  "inline-flex items-center justify-center rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background transition-transform hover:-translate-y-px";
const secondary =
  "inline-flex items-center justify-center rounded-md border border-border-strong bg-surface-1/70 px-5 py-2.5 text-[13px] font-medium tracking-wide text-foreground transition-colors hover:bg-surface-2";

function ActionButton({ action, fallback }: { action: EmptyStateAction; fallback: "primary" | "secondary" }) {
  const cls = (action.variant ?? fallback) === "primary" ? primary : secondary;
  if (action.to) {
    return (
      <Link to={action.to} className={cls}>
        {action.label}
      </Link>
    );
  }
  if (action.href) {
    return (
      <a href={action.href} className={cls}>
        {action.label}
      </a>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={cls}>
      {action.label}
    </button>
  );
}

export function EmptyState({
  eyebrow,
  title,
  description,
  actions = [],
  icon,
  compact = false,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto rounded-xl border border-border bg-surface-1/80 text-center shadow-card",
        compact ? "max-w-xl p-8" : "max-w-lg p-10",
        className,
      )}
    >
      {icon ? (
        <div className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-lg border border-border bg-surface-2 text-muted-foreground">
          {icon}
        </div>
      ) : null}
      {eyebrow ? (
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-gold">
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "tracking-tight",
          eyebrow ? "mt-4" : "",
          compact ? "text-lg font-semibold" : "text-xl font-semibold",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children}
      {actions.length > 0 ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {actions.map((a, i) => (
            <ActionButton key={a.label} action={a} fallback={i === 0 ? "primary" : "secondary"} />
          ))}
        </div>
      ) : null}
    </div>
  );
}