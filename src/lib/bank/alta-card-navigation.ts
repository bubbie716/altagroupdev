import type { AltaCardRow } from "@/lib/bank/alta-card-types";

export type AltaCardBackLink =
  | { to: "/bank/alta-card"; label: string }
  | { to: "/bank/alta-card/business/$companyId"; params: { companyId: string }; label: string };

export type AltaCardStatementsLink =
  | { to: "/bank/alta-card/$cardId/statements"; params: { cardId: string } }
  | {
      to: "/bank/alta-card/business/$companyId/statements";
      params: { companyId: string };
    };

export type AltaCardStatementDetailLink =
  | {
      to: "/bank/alta-card/$cardId/statements/$statementId";
      params: { cardId: string; statementId: string };
    }
  | {
      to: "/bank/alta-card/business/$companyId/statements/$statementId";
      params: { companyId: string; statementId: string };
    };

export function altaCardDashboardBackLink(
  card: Pick<AltaCardRow, "cardType" | "companyId">,
): AltaCardBackLink {
  if (card.cardType === "business" && card.companyId) {
    return {
      to: "/bank/alta-card/business/$companyId",
      params: { companyId: card.companyId },
      label: "← Back to card",
    };
  }
  return {
    to: "/bank/alta-card",
    label: "← Back to card",
  };
}

export function altaCardStatementsLink(
  card: Pick<AltaCardRow, "id" | "cardType" | "companyId">,
): AltaCardStatementsLink {
  if (card.cardType === "business" && card.companyId) {
    return {
      to: "/bank/alta-card/business/$companyId/statements",
      params: { companyId: card.companyId },
    };
  }
  return {
    to: "/bank/alta-card/$cardId/statements",
    params: { cardId: card.id },
  };
}

export function altaCardStatementDetailLink(
  card: Pick<AltaCardRow, "id" | "cardType" | "companyId">,
  statementId: string,
): AltaCardStatementDetailLink {
  if (card.cardType === "business" && card.companyId) {
    return {
      to: "/bank/alta-card/business/$companyId/statements/$statementId",
      params: { companyId: card.companyId, statementId },
    };
  }
  return {
    to: "/bank/alta-card/$cardId/statements/$statementId",
    params: { cardId: card.id, statementId },
  };
}

export const altaCardBackLinkClassName =
  "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground";
