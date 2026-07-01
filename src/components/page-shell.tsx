import { memo, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";
import { useRouteTransition } from "@/components/navigation/route-transition";
import { SiteNav } from "./site-nav";
import { PublicFooter, PlatformFooter } from "./footers";
import {
  type FooterVariant,
  resolveFooterVariant,
  resolvePlatformFooterContext,
} from "@/lib/platform/footer-variant";

function PageFooter({
  variant,
  pathname,
}: {
  variant: FooterVariant;
  pathname: string;
}) {
  if (variant === "none" || variant === "legal") return null;
  if (variant === "platform") {
    return <PlatformFooter context={resolvePlatformFooterContext(pathname)} />;
  }
  return <PublicFooter />;
}

export function PageShell({
  eyebrow,
  title,
  description,
  subtitle,
  action,
  children,
  hideFooter = false,
  footerVariant,
  printDocument = false,
  animateHero = true,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  hideFooter?: boolean;
  /** Overrides route-based footer selection. Legal footers belong on auth shells, not PageShell. */
  footerVariant?: FooterVariant;
  /** Hides site chrome and page hero when printing (e.g. bank statements). */
  printDocument?: boolean;
  /** When false, skips the hero entrance animation (used by persistent /bank layout). */
  animateHero?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { suppressEntranceAnimations } = useRouteTransition();
  const shouldAnimateHero = animateHero && !suppressEntranceAnimations;
  const resolvedVariant = hideFooter
    ? "none"
    : (footerVariant ?? resolveFooterVariant(pathname));

  return (
    <div className={cn("min-h-screen overflow-x-clip bg-background", printDocument && "statement-print-page")}>
      <SiteNav />
      <div
        className={cn(
          "mx-auto min-w-0 max-w-[1400px] px-4 sm:px-6 pt-8 sm:pt-14",
          printDocument && "print:max-w-none print:px-0 print:pt-0",
        )}
      >
        <div
          className={cn(
            "page-shell-hero border-b border-border/60 pb-6 sm:pb-10",
            shouldAnimateHero && "animate-rise",
            printDocument && "print:hidden",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className={type.eyebrow}>{eyebrow}</div>
              <h1 className={cn(type.display, "mt-3 sm:mt-4 break-words")}>{title}</h1>
              {subtitle ? (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
              {description && (
                <p className={cn(type.body, "mt-3 sm:mt-4 max-w-2xl text-muted-foreground break-words")}>
                  {description}
                </p>
              )}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        </div>
        <main className={cn("min-w-0 py-8 sm:py-12", printDocument && "print:py-0")}>{children}</main>
      </div>
      <PageFooter variant={resolvedVariant} pathname={pathname} />
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