import type { ReactNode } from "react";
import { EmptyState } from "@/components/data/empty-state";

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
    <EmptyState
      eyebrow="Alta Bank"
      title={title}
      description={description}
      actions={[{ label: ctaLabel, to: ctaTo }]}
    >
      {children}
    </EmptyState>
  );
}
