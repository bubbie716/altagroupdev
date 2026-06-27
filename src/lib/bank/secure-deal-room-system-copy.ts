/** Institutional SYSTEM message copy for V1 Secure Deal Rooms. */

export const SECURE_DEAL_ROOM_CONTACT_LINE =
  "If additional information is required, Alta Credit Desk will contact you through this Secure Deal Room.";

export const SECURE_DEAL_ROOM_CLOSED_LINE = "This Secure Deal Room has been closed.";

export const LENDING_THREAD_WELCOME_MESSAGE = [
  "Your application has been received and is now under review.",
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

export function formatAltaCreditDeskNote(note?: string | null): string {
  const trimmed = note?.trim();
  if (!trimmed) return "";
  return `\n\nNote from Alta Credit Desk:\n\n${trimmed}`;
}

export function formatAltaCreditDeskReason(reason?: string | null): string {
  const trimmed = reason?.trim();
  if (!trimmed) return "";
  return `\n\nReason from Alta Credit Desk:\n\n${trimmed}`;
}

export function buildLendingApplicationAcceptedSystemMessage(reviewNote?: string | null): string {
  return [
    "Your application has been accepted.",
    SECURE_DEAL_ROOM_CLOSED_LINE,
  ].join("\n\n") + formatAltaCreditDeskNote(reviewNote);
}

export function buildLendingApplicationDeniedSystemMessage(reviewNote?: string | null): string {
  return [
    "Your application has been denied.",
    SECURE_DEAL_ROOM_CLOSED_LINE,
  ].join("\n\n") + formatAltaCreditDeskReason(reviewNote);
}

export function buildAltaCardApplicationAcceptedSystemMessage(): string {
  return [
    "Your Alta Card application has been accepted.",
    SECURE_DEAL_ROOM_CLOSED_LINE,
  ].join("\n\n");
}

export function buildAltaCardApplicationDeniedSystemMessage(denialReason?: string | null): string {
  return [
    "Your Alta Card application has been denied.",
    SECURE_DEAL_ROOM_CLOSED_LINE,
  ].join("\n\n") + formatAltaCreditDeskReason(denialReason);
}

export function formatReviewNeedsInformationThreadMessage(reason: string): string {
  const trimmed = reason.trim();
  const sections = ["Additional information is required to continue reviewing your request."];
  if (trimmed) {
    sections.push("", "Reason:", "", trimmed);
  }
  return sections.join("\n");
}
