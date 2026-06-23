import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";

type EmptyBankStateProps = {
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaTo?: string;
  children?: ReactNode;
};

export function EmptyBankState({
  title = "No Alta Bank accounts yet.",
  description = "Open an Alta Bank account to view balances, transfers, and activity here.",
  ctaLabel = "Open an Account",
  ctaTo = "/bank/open",
  children,
}: EmptyBankStateProps) {
  return (
    <Card className="mx-auto max-w-lg !p-10 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">Alta Bank</p>
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
