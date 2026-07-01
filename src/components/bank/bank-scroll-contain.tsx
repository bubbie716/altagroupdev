import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Prevents bank cards and tables from forcing page-level horizontal scroll. */
export const bankContainClass = "min-w-0 max-w-full";

/** Outer shell for bordered table blocks inside bank pages. */
export const bankTableShellClass = cn(
  bankContainClass,
  "overflow-hidden rounded-xl border border-border bg-surface-1",
);

/** Scroll container for wide tables on tablet+; hidden when a mobile stack is shown. */
export function BankTableScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("hidden max-w-full min-w-0 overflow-x-auto overscroll-x-contain md:block", className)}>
      {children}
    </div>
  );
}

/** Mobile-only stacked rows; pair with BankTableScroll for md+ tables. */
export function BankMobileStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-border md:hidden", className)}>
      {children}
    </div>
  );
}

export function BankMobileStackRow({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={cn("space-y-2 px-4 py-4 sm:px-5", className)}>
      {children}
    </div>
  );
}

export function BankMobileStackField({
  label,
  children,
  align = "start",
}: {
  label: string;
  children: ReactNode;
  align?: "start" | "end";
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 text-[13px]",
        align === "end" && "flex-row-reverse text-right",
      )}
    >
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

/** Vertical scroll for long activity lists — keeps account pages from growing endlessly. */
export const bankActivityScrollFullClass =
  "max-h-[min(36rem,60vh)] overflow-y-auto overscroll-contain";

export const bankActivityScrollCompactClass =
  "max-h-[min(24rem,45vh)] overflow-y-auto overscroll-contain";

export function BankActivityScroll({
  children,
  className,
  size = "full",
}: {
  children: ReactNode;
  className?: string;
  size?: "full" | "compact";
}) {
  return (
    <div
      className={cn(
        size === "compact" ? bankActivityScrollCompactClass : bankActivityScrollFullClass,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Horizontal nav scroll that stays inside the page — no negative margins. */
export function BankSubNavScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 min-w-0 overflow-x-auto overscroll-x-contain sm:mb-8", className)}>
      {children}
    </div>
  );
}

export const bankSubNavClass =
  "flex w-max max-w-full gap-1 border-b border-border/60 pb-3 sm:w-full sm:flex-wrap sm:pb-4 [&>*]:shrink-0 [&>*]:whitespace-nowrap";
