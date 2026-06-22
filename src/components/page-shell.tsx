import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { SiteNav, SiteFooter } from "./site-nav";

export function PageShell({
  eyebrow,
  title,
  description,
  children,
  hideFooter = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  hideFooter?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto max-w-[1400px] px-6 pt-14">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="border-b border-border/60 pb-10"
        >
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-gold">
            {eyebrow}
          </div>
          <h1 className="mt-4 text-[clamp(2.75rem,5.5vw,4.5rem)] font-semibold leading-[1.0] tracking-[-0.015em]">
            {title}
          </h1>
          {description && (
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </motion.div>
        <main className="py-12">{children}</main>
      </div>
      {!hideFooter && <SiteFooter />}
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
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {title}
          </h2>
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
        "rounded-xl border border-border bg-surface-1/80 p-6 shadow-card transition-all duration-300 hover:border-border-strong hover:-translate-y-0.5 hover:shadow-elevated " +
        className
      }
    >
      {children}
    </div>
  );
}