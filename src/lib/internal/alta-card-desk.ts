/** Attention and directory helpers for Alta Card product desk. */

import type { AltaCardRow, AltaCardStatusCode } from "@/lib/bank/alta-card-types";
import { ALTA_CARD_TIER_LABELS, formatAltaCardCurrency } from "@/lib/bank/alta-card-types";

export type CardAttentionItem = {
  id: string;
  label: string;
  count: number;
  to: string;
  search: Record<string, unknown>;
  cta: string;
  tone: "alert" | "warn" | "info" | "neutral";
};

export function maskAltaCardLastFour(lastFour: string): string {
  const digits = lastFour.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `•••• ${digits}`;
}

export function cardNeedsDirectoryAttention(card: AltaCardRow): boolean {
  const s = card.status;
  return s === "frozen" || s === "delinquent" || s === "lost";
}

export function cardHolderType(card: AltaCardRow): "personal" | "company" {
  return card.companyId || card.companyName ? "company" : "personal";
}

export function buildAltaCardAttentionItems(input: {
  pendingApplications: number;
  openReviews: number;
  lostStolen: number;
  delinquent: number;
  siteKey: string;
  withSite: (base: Record<string, unknown>, site?: string) => Record<string, unknown>;
}): CardAttentionItem[] {
  const { pendingApplications, openReviews, lostStolen, delinquent, siteKey, withSite } = input;
  const items: CardAttentionItem[] = [];
  if (pendingApplications > 0) {
    items.push({
      id: "card-apps",
      label: "Pending applications",
      count: pendingApplications,
      to: "/internal/inbox",
      search: withSite({ category: "cards", type: "alta_card_application" }, siteKey),
      cta: "Review card application",
      tone: "alert",
    });
  }
  if (openReviews > 0) {
    items.push({
      id: "card-reviews",
      label: "Account reviews",
      count: openReviews,
      to: "/internal/inbox",
      search: withSite({ category: "cards", type: "alta_card_review" }, siteKey),
      cta: "Review account review",
      tone: "warn",
    });
  }
  if (lostStolen > 0) {
    items.push({
      id: "card-lost",
      label: "Lost or stolen cards",
      count: lostStolen,
      to: "/internal/alta-card/cards",
      search: withSite({ attention: "1", status: "lost" }, siteKey),
      cta: "Review card",
      tone: "alert",
    });
  }
  if (delinquent > 0) {
    items.push({
      id: "card-delinquent",
      label: "Delinquent accounts",
      count: delinquent,
      to: "/internal/alta-card/cards",
      search: withSite({ status: "delinquent", attention: "1" }, siteKey),
      cta: "Review card",
      tone: "alert",
    });
  }
  return items;
}

export function sortCardsForDirectory(cards: AltaCardRow[]): AltaCardRow[] {
  const rank = (s: AltaCardStatusCode): number => {
    if (s === "lost") return 0;
    if (s === "delinquent") return 1;
    if (s === "frozen") return 2;
    if (s === "pending") return 3;
    if (s === "active") return 4;
    return 5;
  };
  return [...cards].sort((a, b) => {
    const aAtt = cardNeedsDirectoryAttention(a) ? 0 : 1;
    const bAtt = cardNeedsDirectoryAttention(b) ? 0 : 1;
    if (aAtt !== bAtt) return aAtt - bAtt;
    const sr = rank(a.status) - rank(b.status);
    if (sr !== 0) return sr;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function cardDirectoryPrimaryLabel(card: AltaCardRow): string {
  return card.ownerUsername ?? card.companyName ?? "Cardholder";
}

export function cardDirectorySecondaryLabel(card: AltaCardRow): string {
  const mask = maskAltaCardLastFour(card.cardLastFour);
  const tier = ALTA_CARD_TIER_LABELS[card.tier];
  return `${mask} · ${tier}`;
}

export function cardBalanceLimitLabel(card: AltaCardRow): string {
  return `${formatAltaCardCurrency(card.currentBalance)} / ${formatAltaCardCurrency(card.creditLimit)}`;
}

export function altaCardFiltersActive(search: {
  q?: string;
  status?: string;
  cardType?: string;
  attention?: string;
}): boolean {
  return Boolean(search.q || search.status || search.cardType || search.attention);
}
