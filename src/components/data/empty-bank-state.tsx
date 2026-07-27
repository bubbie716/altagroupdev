import type { ReactNode } from "react";
import { EmptyState } from "@/components/data/empty-state";

type EmptyBankStateProps = {
  title?: string;
  description?: string;
  ctaLabel?: string | null;
  ctaTo?: string | null;
  children?: ReactNode;
};

export function EmptyBankState({
  title = "No Alta Bank accounts yet.",
  description = "Open an Alta Bank account to view balances, transfers, and activity here.",
  ctaLabel = "Open an Account",
  ctaTo = "/bank/open",
  children,
}: EmptyBankStateProps) {
  const actions =
    ctaLabel && ctaTo
      ? [{ label: ctaLabel, to: ctaTo }]
      : undefined;

  return (
    <EmptyState
      eyebrow="Alta Bank"
      title={title}
      description={description}
      actions={actions}
    >
      {children ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>
      ) : null}
    </EmptyState>
  );
}
