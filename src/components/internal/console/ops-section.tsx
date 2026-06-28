import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Dense section wrapper for internal console pages (replaces marketing Section spacing). */
export function OpsSection({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      {title ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
