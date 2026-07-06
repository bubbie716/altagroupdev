import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { LOADING_COPY } from "@/lib/ui/route-loading";
import { cn } from "@/lib/utils";

export function RoutePendingFallback({
  label = LOADING_COPY.route,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 items-center justify-center py-12", className)}
      aria-busy="true"
      aria-live="polite"
    >
      <LoadingIndicator label={label} />
    </div>
  );
}

export function LoadingIndicator({
  label = LOADING_COPY.default,
  className,
  size = "sm",
}: {
  label?: ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
      <Loader2
        className={cn("animate-spin shrink-0", size === "sm" ? "size-3.5" : "size-4")}
        aria-hidden
      />
      <span className={cn(size === "sm" ? "text-[13px]" : "text-sm")}>{label}</span>
    </div>
  );
}

/** Inline loading line for panels and dialogs. */
export function LoadingMessage({
  children = LOADING_COPY.default,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <LoadingIndicator
      label={children}
      className={className}
      size="sm"
    />
  );
}
