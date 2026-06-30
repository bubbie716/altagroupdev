/** Institutional SYSTEM message copy for V1 Secure Deal Rooms. */

import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_TIER_LABELS,
  formatAltaCardCurrency,
  formatAltaCardRate,
} from "@/lib/bank/alta-card-types";

export const SECURE_DEAL_ROOM_CONTACT_LINE =
  "If additional information is required, Alta Credit Desk will contact you through this Secure Deal Room.";

export const SECURE_DEAL_ROOM_CLOSED_LINE = "This Secure Deal Room has been closed.";

export const LENDING_THREAD_WELCOME_MESSAGE = [
  "Your application has been received. Status: Waiting on Alta.",
  SECURE_DEAL_ROOM_CONTACT_LINE,
].join("\n\n");

export const ALTA_CARD_APPLICATION_THREAD_WELCOME_MESSAGE = [
  "Your Alta Card application has been received and review has begun.",
  SECURE_DEAL_ROOM_CONTACT_LINE,
].join("\n\n");

export const ALTA_CARD_REVIEW_THREAD_WELCOME_MESSAGE = [
  "Your account review has been received and review has begun.",
  SECURE_DEAL_ROOM_CONTACT_LINE,
].join("\n\n");

/** @deprecated Use LENDING_THREAD_WELCOME_MESSAGE — kept for docs and status copy references. */
export const LOAN_APPLICATION_SUBMITTED_MESSAGE = LENDING_THREAD_WELCOME_MESSAGE;

/** Internal operator notes — never append to customer-facing system messages. */
export function formatAltaCreditDeskNote(note?: string | null): string {
  const trimmed = note?.trim();
  if (!trimmed) return "";
  return `\n\nNote from Alta Credit Desk:\n\n${trimmed}`;
}

/** Internal denial reasons — never append to customer-facing system messages. */
export function formatAltaCreditDeskReason(reason?: string | null): string {
  const trimmed = reason?.trim();
  if (!trimmed) return "";
  return `\n\nReason from Alta Credit Desk:\n\n${trimmed}`;
}

const CUSTOMER_HIDDEN_THREAD_MARKERS = [
  "\n\nNote from Alta Credit Desk:\n\n",
  "\n\nReason from Alta Credit Desk:\n\n",
] as const;

/** Strip operator notes/reasons from persisted thread messages shown to customers. */
export function stripAdminReasonFromCustomerThreadBody(body: string): string {
  let result = body;
  for (const marker of CUSTOMER_HIDDEN_THREAD_MARKERS) {
    const index = result.indexOf(marker);
    if (index !== -1) {
      result = result.slice(0, index).trimEnd();
    }
  }
  return result;
}

export function buildLendingApplicationAcceptedSystemMessage(_reviewNote?: string | null): string {
  return [
    "Your application has been accepted.",
    SECURE_DEAL_ROOM_CLOSED_LINE,
  ].join("\n\n");
}

export function buildLendingApplicationDeniedSystemMessage(_reviewNote?: string | null): string {
  return [
    "Your application has been denied.",
    SECURE_DEAL_ROOM_CLOSED_LINE,
  ].join("\n\n");
}

export function buildLendingApplicationCancelledSystemMessage(_reason?: string | null): string {
  return [
    "Your application has been cancelled because the Credit Desk is closed.",
    SECURE_DEAL_ROOM_CLOSED_LINE,
  ].join("\n\n");
}

export function buildAltaCardApplicationCancelledSystemMessage(_reason?: string | null): string {
  return [
    "Your Alta Card application has been cancelled because the Credit Desk is closed.",
    SECURE_DEAL_ROOM_CLOSED_LINE,
  ].join("\n\n");
}

export function buildAltaCardApplicationAcceptedSystemMessage(input: {
  tier: AltaCardTierCode;
  approvedLimit: number;
  interestRate: number;
  reviewNote?: string | null;
}): string {
  const sections = [
    "Your Alta Card application has been approved.",
    SECURE_DEAL_ROOM_CLOSED_LINE,
    "",
    "Approved terms:",
    `• Card tier: ${ALTA_CARD_TIER_LABELS[input.tier]}`,
    `• Credit limit: ${formatAltaCardCurrency(input.approvedLimit)}`,
    `• Interest rate: ${formatAltaCardRate(input.interestRate)}`,
  ];

  return sections.join("\n");
}

export function buildAltaCardApplicationDeniedSystemMessage(_denialReason?: string | null): string {
  return [
    "Your Alta Card application has been denied.",
    SECURE_DEAL_ROOM_CLOSED_LINE,
  ].join("\n\n");
}

export function formatReviewNeedsInformationThreadMessage(reason: string): string {
  const trimmed = reason.trim();
  const sections = ["Additional information is required to continue reviewing your request."];
  if (trimmed) {
    sections.push("", "Reason:", "", trimmed);
  }
  return sections.join("\n");
}
