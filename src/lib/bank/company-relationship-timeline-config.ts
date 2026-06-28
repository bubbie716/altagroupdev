import type { CompanyRelationshipTimelineEventRow } from "@/lib/bank/company-relationship-intelligence-types";

export {
  ALTA_PAY_VOLUME_MILESTONES,
  LIFETIME_DEPOSITS_MILESTONES,
  LIFETIME_WITHDRAWALS_MILESTONES,
  milestoneDedupeKey,
} from "@/lib/bank/relationship-timeline-config";

export const CUSTOMER_VISIBLE_COMPANY_TIMELINE_EVENT_TYPES = new Set<string>([
  "RELATIONSHIP_STARTED",
  "BUSINESS_ACCOUNT_OPENED",
  "DEPOSIT_MILESTONE",
  "WITHDRAWAL_MILESTONE",
  "ALTA_PAY_MILESTONE",
  "ALTA_CARD_OPENED",
  "ALTA_CARD_TIER_CHANGED",
  "ALTA_CARD_LIMIT_CHANGED",
  "LOAN_FUNDED",
  "LOAN_PAID_OFF",
  "LOAN_PAYMENT_MADE",
  "RELATIONSHIP_TIER_CHANGED",
  "COMMERCIAL_BANKING_ELIGIBLE",
]);

export function isCustomerVisibleCompanyTimelineEvent(
  event: Pick<CompanyRelationshipTimelineEventRow, "eventType">,
): boolean {
  return CUSTOMER_VISIBLE_COMPANY_TIMELINE_EVENT_TYPES.has(event.eventType);
}
