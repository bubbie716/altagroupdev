import type { ReactNode } from "react";
import { EmptyState } from "@/components/data/empty-state";

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
  return (
    <EmptyState
      eyebrow={compact ? "Alta Portfolio" : "An Alta Exchange Product"}
      title={title}
      description={description}
      compact={compact}
      actions={[
        compact
          ? { label: ctaLabel, to: ctaTo, variant: "secondary" }
          : { label: ctaLabel, to: ctaTo },
      ]}
    >
      {children}
    </EmptyState>
  );
}
