import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";

type EmptyPortfolioStateProps = {
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaTo?: string;
  children?: ReactNode;
  compact?: boolean;
};

export function EmptyPortfolioState({
  title = "No portfolio connected yet.",
  description = "Sign in to access Alta Exchange Terminal and track holdings, orders, and performance.",
  ctaLabel = "Open Alta Exchange Terminal",
  ctaTo = "/terminal",
  children,
  compact = false,
}: EmptyPortfolioStateProps) {
  if (compact) {
    return (
      <div className="rounded-xl border border-border bg-surface-1 p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Alta Portfolio</p>
        <h3 className="mt-3 text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        {children}
        <Link
          to={ctaTo}
          className="mt-6 inline-block rounded-md border border-border px-5 py-2.5 text-[13px] font-medium tracking-wide"
        >
          {ctaLabel}
        </Link>
      </div>
    );
  }

  return (
    <Card className="mx-auto max-w-lg !p-10 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">An Alta Exchange Product</p>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-muted-foreground">{description}</p>
      {children}
      <Link
        to={ctaTo}
        className="mt-8 inline-block rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background"
      >
        {ctaLabel}
      </Link>
    </Card>
  );
}
