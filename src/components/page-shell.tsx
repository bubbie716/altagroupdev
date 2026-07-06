import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";
import { useRouteTransition } from "@/components/navigation/route-transition";
import { SiteNav } from "./site-nav";

export function PageShell({
  eyebrow,
  title,
  description,
  subtitle,
  action,
  children,
  printDocument = false,
  animateHero = true,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  /** @deprecated Site footer is rendered once at the root via SiteFooterGate. */
  hideFooter?: boolean;
  /** @deprecated Site footer is resolved globally from the route path. */
  footerVariant?: never;
  /** Hides site chrome and page hero when printing (e.g. bank statements). */
  printDocument?: boolean;
  /** When false, skips the hero entrance animation (used by persistent /bank layout). */
  animateHero?: boolean;
}) {
  const { suppressEntranceAnimations } = useRouteTransition();
  const shouldAnimateHero = animateHero && !suppressEntranceAnimations;

  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col overflow-x-clip bg-background", printDocument && "statement-print-page")}>
      <SiteNav />
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full min-w-0 max-w-[1400px] flex-1 flex-col px-4 sm:px-6 pt-8 sm:pt-14",
          printDocument && "print:max-w-none print:px-0 print:pt-0",
        )}
      >
        <div
          className={cn(
            "page-shell-hero shrink-0 border-b border-border/60 pb-6 sm:pb-10 min-h-[11rem] sm:min-h-[13rem]",
            shouldAnimateHero && "animate-rise",
            printDocument && "print:hidden",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className={type.eyebrow}>{eyebrow}</div>
              <h1 className={cn(type.display, "mt-3 sm:mt-4 break-words")}>{title}</h1>
              <p
                className={cn(
                  "mt-2 min-h-[1.25rem] font-mono text-[10px] uppercase tracking-[0.2em]",
                  subtitle ? "text-muted-foreground" : "invisible",
                )}
                aria-hidden={!subtitle}
              >
                {subtitle ?? "Subtitle"}
              </p>
              <p
                className={cn(
                  type.body,
                  "mt-3 sm:mt-4 max-w-2xl min-h-[3.25rem] break-words sm:min-h-[3.5rem]",
                  description ? "text-muted-foreground" : "invisible",
                )}
                aria-hidden={!description}
              >
                {description ?? "Description"}
              </p>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        </div>
        <main className={cn("flex min-h-0 flex-1 flex-col py-8 sm:py-12", printDocument && "print:py-0")}>{children}</main>
      </div>
    </div>
  );
}

export function Section({
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
      {title && (
        <div className="mb-4 flex items-end justify-between">
          <h2 className={type.sectionTitle}>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "min-w-0 max-w-full rounded-xl border border-border bg-surface-1/80 p-5 sm:p-6 transition-colors duration-200 hover:border-border-strong " +
        className
      }
    >
      {children}
    </div>
  );
}
