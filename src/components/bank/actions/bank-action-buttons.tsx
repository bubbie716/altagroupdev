"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function BankActionFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2", className)}>
      {children}
    </div>
  );
}

export function BankActionPrimaryButton({
  children,
  type = "button",
  disabled,
  loading,
  onClick,
  className,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-[13px] font-medium text-background transition-colors",
        "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function BankActionSecondaryButton({
  children,
  disabled,
  onClick,
  className,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center rounded-md border border-border px-4 text-[13px] font-medium",
        "hover:bg-[var(--menu-item-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
