import { Link } from "@tanstack/react-router";
import type { AltaCardRow } from "@/lib/bank/alta-card-types";
import {
  altaCardBackLinkClassName,
  altaCardDashboardBackLink,
} from "@/lib/bank/alta-card-navigation";

export function AltaCardBackToCardLink({
  card,
}: {
  card: Pick<AltaCardRow, "cardType" | "companyId">;
}) {
  const backLink = altaCardDashboardBackLink(card);
  if (backLink.to === "/bank/alta-card/business/$companyId") {
    return (
      <Link to={backLink.to} params={backLink.params} className={altaCardBackLinkClassName}>
        {backLink.label}
      </Link>
    );
  }
  return (
    <Link to={backLink.to} className={altaCardBackLinkClassName}>
      {backLink.label}
    </Link>
  );
}