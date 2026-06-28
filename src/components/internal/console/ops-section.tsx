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
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-border/50 pb-2">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="mr-2 inline-block h-1 w-1 translate-y-[-2px] rounded-full bg-gold/70 align-middle" aria-hidden />
            {title}
          </h2>
          {action ? <div className="flex items-center gap-1.5">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
