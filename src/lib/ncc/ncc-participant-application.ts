import type { NccParticipantApplicationStatus } from "@prisma/client";

/** Opaque participant-owned account-identifier profile — not an NCC regex. */
export type AccountIdentifierFormatProfile = {
  displayLabel: string;
  minLength?: number | null;
  maxLength?: number | null;
  characterFormatDescription: string;
  exampleMaskedIdentifier: string;
  caseSensitive: boolean;
  normalizationNotes?: string | null;
  branchCodeRequired: boolean;
  supportedCurrencies: string[];
  containsLetters: boolean;
  containsNumbers: boolean;
  containsSpaces: boolean;
  containsPunctuation: boolean;
  examples?: string[];
};

export const DEFAULT_REQUIRED_DOCUMENTS = [
  "Regulatory license or registration certificate",
  "Proof of registered address",
  "Primary contact identity attestation",
] as const;

const APPLICANT_TRANSITIONS: Record<
  NccParticipantApplicationStatus,
  ReadonlySet<NccParticipantApplicationStatus>
> = {
  DRAFT: new Set(["SUBMITTED", "WITHDRAWN"]),
  SUBMITTED: new Set(["WITHDRAWN"]),
  UNDER_REVIEW: new Set(["WITHDRAWN"]),
  INFORMATION_REQUIRED: new Set(["UNDER_REVIEW", "WITHDRAWN"]),
  TECHNICAL_REVIEW: new Set(["WITHDRAWN"]),
  APPROVED_FOR_TEST: new Set(),
  CERTIFICATION: new Set(),
  APPROVED_FOR_LIVE: new Set(),
  REJECTED: new Set(),
  WITHDRAWN: new Set(),
};

const STAFF_TRANSITIONS: Record<
  NccParticipantApplicationStatus,
  ReadonlySet<NccParticipantApplicationStatus>
> = {
  DRAFT: new Set(),
  SUBMITTED: new Set(["UNDER_REVIEW", "REJECTED"]),
  UNDER_REVIEW: new Set([
    "INFORMATION_REQUIRED",
    "TECHNICAL_REVIEW",
    "APPROVED_FOR_TEST",
    "REJECTED",
  ]),
  INFORMATION_REQUIRED: new Set(["UNDER_REVIEW", "REJECTED"]),
  TECHNICAL_REVIEW: new Set([
    "INFORMATION_REQUIRED",
    "APPROVED_FOR_TEST",
    "REJECTED",
  ]),
  APPROVED_FOR_TEST: new Set(["CERTIFICATION", "REJECTED"]),
  CERTIFICATION: new Set(["APPROVED_FOR_LIVE", "INFORMATION_REQUIRED", "REJECTED"]),
  APPROVED_FOR_LIVE: new Set(),
  REJECTED: new Set(),
  WITHDRAWN: new Set(),
};

export function canApplicantTransition(
  from: NccParticipantApplicationStatus,
  to: NccParticipantApplicationStatus,
): boolean {
  return APPLICANT_TRANSITIONS[from]?.has(to) ?? false;
}

export function canStaffTransition(
  from: NccParticipantApplicationStatus,
  to: NccParticipantApplicationStatus,
): boolean {
  return STAFF_TRANSITIONS[from]?.has(to) ?? false;
}

/** Fields locked after submission unless INFORMATION_REQUIRED. */
export function applicationFieldsLocked(status: NccParticipantApplicationStatus): boolean {
  return status !== "DRAFT" && status !== "INFORMATION_REQUIRED";
}

export function parseAccountIdentifierFormat(value: unknown): AccountIdentifierFormatProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ACCOUNT_FORMAT_REQUIRED");
  }
  const v = value as Record<string, unknown>;
  const displayLabel = String(v.displayLabel ?? "").trim();
  const characterFormatDescription = String(v.characterFormatDescription ?? "").trim();
  const exampleMaskedIdentifier = String(v.exampleMaskedIdentifier ?? "").trim();
  if (!displayLabel || !characterFormatDescription || !exampleMaskedIdentifier) {
    throw new Error("ACCOUNT_FORMAT_REQUIRED");
  }
  const currencies = Array.isArray(v.supportedCurrencies)
    ? v.supportedCurrencies.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
    : ["FLR"];
  const examples = Array.isArray(v.examples)
    ? v.examples.map((e) => String(e)).filter(Boolean).slice(0, 8)
    : [];
  return {
    displayLabel: displayLabel.slice(0, 120),
    minLength: typeof v.minLength === "number" ? v.minLength : null,
    maxLength: typeof v.maxLength === "number" ? v.maxLength : null,
    characterFormatDescription: characterFormatDescription.slice(0, 2000),
    exampleMaskedIdentifier: exampleMaskedIdentifier.slice(0, 64),
    caseSensitive: Boolean(v.caseSensitive),
    normalizationNotes:
      typeof v.normalizationNotes === "string" ? v.normalizationNotes.trim().slice(0, 2000) : null,
    branchCodeRequired: Boolean(v.branchCodeRequired),
    supportedCurrencies: currencies.length ? currencies : ["FLR"],
    containsLetters: Boolean(v.containsLetters),
    containsNumbers: Boolean(v.containsNumbers),
    containsSpaces: Boolean(v.containsSpaces),
    containsPunctuation: Boolean(v.containsPunctuation),
    examples,
  };
}
