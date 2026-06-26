import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";
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
  children,
  hideFooter = false,
  footerVariant,
  printDocument = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  hideFooter?: boolean;
  /** Overrides route-based footer selection. Legal footers belong on auth shells, not PageShell. */
  footerVariant?: FooterVariant;
  /** Hides site chrome and page hero when printing (e.g. bank statements). */
  printDocument?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const resolvedVariant = hideFooter
    ? "none"
    : (footerVariant ?? resolveFooterVariant(pathname));

  return (
    <div className={cn("min-h-screen bg-background", printDocument && "statement-print-page")}>
      <SiteNav />
      <div
        className={cn(
          "mx-auto max-w-[1400px] px-4 sm:px-6 pt-8 sm:pt-14",
          printDocument && "print:max-w-none print:px-0 print:pt-0",
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={cn("page-shell-hero border-b border-border/60 pb-6 sm:pb-10", printDocument && "print:hidden")}
        >
          <div className={type.eyebrow}>{eyebrow}</div>
          <h1 className={cn(type.display, "mt-3 sm:mt-4 break-words")}>{title}</h1>
          {description && (
            <p className={cn(type.body, "mt-3 sm:mt-4 max-w-2xl text-muted-foreground break-words")}>{description}</p>
          )}
        </motion.div>
        <main className={cn("py-8 sm:py-12", printDocument && "print:py-0")}>{children}</main>
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
    <section className={className}>
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
        "rounded-xl border border-border bg-surface-1/80 p-5 sm:p-6 transition-colors duration-200 hover:border-border-strong " +
        className
      }
    >
      {children}
    </div>
  );
}