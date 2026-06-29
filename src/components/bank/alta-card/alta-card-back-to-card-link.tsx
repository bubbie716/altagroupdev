import type { ReactNode } from "react";
import { RouteButton } from "@/components/bank/route-button";
import { cn } from "@/lib/utils";
import type { AltaCardRow } from "@/lib/bank/alta-card-types";
import {
  altaCardAllBusinessesBackLink,
  altaCardDashboardBackLink,
  altaCardReviewLink,
} from "@/lib/bank/alta-card-navigation";

export const altaCardNavButtonClassName =
  "shrink-0 rounded-md border border-border bg-surface-2/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-surface-2/80";

export function AltaCardPageNav({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mb-8 flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export function AltaCardBackToCardButton({
  card,
}: {
  card: Pick<AltaCardRow, "cardType" | "companyId">;
}) {
  const backLink = altaCardDashboardBackLink(card);

  return (
    <RouteButton
      to={backLink.to}
      params={"params" in backLink ? backLink.params : undefined}
      className={altaCardNavButtonClassName}
    >
      {backLink.label}
    </RouteButton>
  );
}

export function AltaCardAllReviewsButton({
  card,
}: {
  card: Pick<AltaCardRow, "id" | "cardType" | "companyId">;
}) {
  const reviewsLink = altaCardReviewLink(card);

  return (
    <RouteButton
      to={reviewsLink.to}
      params={"params" in reviewsLink ? reviewsLink.params : undefined}
      className={altaCardNavButtonClassName}
    >
      ← All reviews
    </RouteButton>
  );
}

export function AltaCardBackToAllBusinessesButton() {
  const backLink = altaCardAllBusinessesBackLink();

  return (
    <RouteButton to={backLink.to} className={altaCardNavButtonClassName}>
      {backLink.label}
    </RouteButton>
  );
}

/** @deprecated Use AltaCardBackToCardButton */
export const AltaCardBackToCardLink = AltaCardBackToCardButton;
