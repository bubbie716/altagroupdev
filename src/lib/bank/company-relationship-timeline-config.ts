import type { CompanyRelationshipTimelineEventRow } from "@/lib/bank/company-relationship-intelligence-types";

export {
  ALTA_PAY_VOLUME_MILESTONES,
  LIFETIME_DEPOSITS_MILESTONES,
  LIFETIME_WITHDRAWALS_MILESTONES,
  TOTAL_ALTA_ASSETS_MILESTONES,
  milestoneDedupeKey,
} from "@/lib/bank/relationship-timeline-config";

/** Same customer-visible moments as the personal timeline, with business program equivalents. */
export const CUSTOMER_VISIBLE_COMPANY_TIMELINE_EVENT_TYPES = new Set<string>([
  "RELATIONSHIP_STARTED",
  "BUSINESS_ACCOUNT_OPENED",
  "DEPOSIT_MILESTONE",
  "ALTA_PAY_MILESTONE",
  "ALTA_CARD_OPENED",
  "ALTA_CARD_TIER_CHANGED",
  "ALTA_CARD_LIMIT_CHANGED",
  "ALTA_CARD_RATE_CHANGED",
  "ALTA_CARD_PAID_ON_TIME",
  "LOAN_FUNDED",
  "LOAN_PAID_OFF",
  "RELATIONSHIP_TIER_CHANGED",
  "COMMERCIAL_BANKING_ELIGIBLE",
]);

export function isCustomerVisibleCompanyTimelineEvent(
  event: Pick<CompanyRelationshipTimelineEventRow, "eventType">,
): boolean {
  return CUSTOMER_VISIBLE_COMPANY_TIMELINE_EVENT_TYPES.has(event.eventType);
}
