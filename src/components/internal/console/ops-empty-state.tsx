import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function OpsEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded border border-border/60 bg-surface-1/30 px-4 py-8 text-center",
        className,
      )}
    >
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
