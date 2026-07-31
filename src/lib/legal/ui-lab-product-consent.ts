/**
 * UI Lab product-consent scenarios — demonstration only.
 * Never writes production LegalAcceptance rows.
 */
import { isUiLabMode } from "@/lib/auth/ui-lab";
import type { LegalConsentScopeId } from "@/lib/legal/consent-scopes";
import { humanizeConsentScope } from "@/lib/legal/consent-scopes";
import {
  getConsentBundleDefinition,
  getConsentControlGroups,
  resolveConsentBundleDocuments,
} from "@/lib/legal/legal-consent-bundle";
import { buildConsentSequence } from "@/lib/legal/product-consent-requirements";
import type { SiteKey } from "@/config/sites";

export type UiLabProductConsentScenario =
  | "bank_first_visit"
  | "bank_current"
  | "bank_terms_updated"
  | "terminal_first_visit"
  | "terminal_reacceptance"
  | "card_missing_bank_and_card"
  | "lending_missing_bank_and_lending"
  | "alta_pay_missing_pay_only"
  | "funding_missing_terminal"
  | "funding_missing_both"
  | "cardholder_view_ok_new_blocked"
  | "borrower_view_ok_new_blocked"
  | "commercial_company_a_ok_b_missing"
  | "commercial_unauthorized"
  | "consent_server_error"
  | "consent_concurrent"
  | "legal_links_preserve"
  | "mobile_consent_sheet"
  | "already_accepted_no_flash"
  | "marketing_ungated"
  | "internal_ungated";

const ALL: UiLabProductConsentScenario[] = [
  "bank_first_visit",
  "bank_current",
  "bank_terms_updated",
  "terminal_first_visit",
  "terminal_reacceptance",
  "card_missing_bank_and_card",
  "lending_missing_bank_and_lending",
  "alta_pay_missing_pay_only",
  "funding_missing_terminal",
  "funding_missing_both",
  "cardholder_view_ok_new_blocked",
  "borrower_view_ok_new_blocked",
  "commercial_company_a_ok_b_missing",
  "commercial_unauthorized",
  "consent_server_error",
  "consent_concurrent",
  "legal_links_preserve",
  "mobile_consent_sheet",
  "already_accepted_no_flash",
  "marketing_ungated",
  "internal_ungated",
];

const STORAGE_KEY = "alta.productConsent.uiLabScenario";
/** Session overlay of scopes accepted during the current browser session (UI Lab only). */
const ACCEPTED_OVERLAY_KEY = "alta.productConsent.uiLabAcceptedOverlay";

export type UiLabAcceptedOverlay = {
  /** User-scoped acceptances recorded this session. */
  user: Partial<Record<LegalConsentScopeId, true>>;
  /** Company-scoped COMMERCIAL acceptances keyed by companyId. */
  companies: Record<string, true>;
};

type StoredOverlay = UiLabAcceptedOverlay & {
  /** Scenario that owns this overlay — mismatched scenarios read as empty. */
  scenario: string | null;
};

/** In-memory fallback for Node unit tests (no sessionStorage). Never trust this across HTTP without a client snapshot. */
let memoryOverlay: StoredOverlay = { scenario: null, user: {}, companies: {} };

/** Bumped on every scenario change so in-flight fetches can be discarded. */
let scenarioGeneration = 0;

export function getUiLabProductConsentScenarioGeneration(): number {
  return scenarioGeneration;
}

function emptyOverlay(): UiLabAcceptedOverlay {
  return { user: {}, companies: {} };
}

function emptyStoredOverlay(): StoredOverlay {
  return { scenario: null, user: {}, companies: {} };
}

function readStoredOverlay(): StoredOverlay {
  if (typeof window === "undefined") {
    return {
      scenario: memoryOverlay.scenario,
      user: { ...memoryOverlay.user },
      companies: { ...memoryOverlay.companies },
    };
  }
  try {
    const raw = window.sessionStorage.getItem(ACCEPTED_OVERLAY_KEY);
    if (!raw) return emptyStoredOverlay();
    const parsed = JSON.parse(raw) as StoredOverlay;
    return {
      scenario: typeof parsed.scenario === "string" ? parsed.scenario : null,
      user: parsed.user ?? {},
      companies: parsed.companies ?? {},
    };
  } catch {
    return emptyStoredOverlay();
  }
}

/**
 * Browser-session overlay snapshot for the given (or current) scenario.
 * Acceptances from a different scenario never apply.
 */
export function getUiLabAcceptedOverlaySnapshot(
  forScenario?: string | null,
): UiLabAcceptedOverlay {
  const scenario =
    forScenario && isUiLabProductConsentScenario(forScenario)
      ? forScenario
      : getUiLabProductConsentScenario();
  const stored = readStoredOverlay();
  if (!stored.scenario || stored.scenario !== scenario) {
    return emptyOverlay();
  }
  return { user: { ...stored.user }, companies: { ...stored.companies } };
}

function writeStoredOverlay(overlay: StoredOverlay): void {
  memoryOverlay = {
    scenario: overlay.scenario,
    user: { ...overlay.user },
    companies: { ...overlay.companies },
  };
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ACCEPTED_OVERLAY_KEY, JSON.stringify(memoryOverlay));
  } catch {
    /* ignore */
  }
}

export function clearUiLabAcceptedScopeOverlay(): void {
  memoryOverlay = emptyStoredOverlay();
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ACCEPTED_OVERLAY_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Record a successful mock acceptance so multi-scope sequences advance within the session
 * without writing production LegalAcceptance rows.
 */
export function recordUiLabAcceptedScope(
  scope: LegalConsentScopeId,
  companyId?: string | null,
  scenario?: string | null,
): void {
  const scen =
    scenario && isUiLabProductConsentScenario(scenario)
      ? scenario
      : getUiLabProductConsentScenario();
  const current = getUiLabAcceptedOverlaySnapshot(scen);
  const next: StoredOverlay = {
    scenario: scen,
    user: { ...current.user },
    companies: { ...current.companies },
  };
  if (scope === "COMMERCIAL" && companyId) {
    next.companies[companyId] = true;
  } else {
    next.user[scope] = true;
  }
  writeStoredOverlay(next);
}

function applyAcceptedOverlay(
  map: AcceptedMap,
  companyId?: string | null,
  overlay?: UiLabAcceptedOverlay | null,
): AcceptedMap {
  const source = overlay ?? emptyOverlay();
  const next: AcceptedMap = { ...map };
  for (const [scope, accepted] of Object.entries(source.user)) {
    if (accepted) next[scope as LegalConsentScopeId] = true;
  }
  if (companyId && source.companies[companyId]) {
    next.COMMERCIAL = true;
  }
  return next;
}

export function isUiLabProductConsentScenario(
  value: string | null | undefined,
): value is UiLabProductConsentScenario {
  return Boolean(value && (ALL as string[]).includes(value));
}

export function getUiLabProductConsentScenario(): UiLabProductConsentScenario {
  if (!isUiLabMode()) return "already_accepted_no_flash";
  if (typeof window !== "undefined") {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("uiLabProductConsent");
      if (isUiLabProductConsentScenario(fromUrl)) return fromUrl;
    } catch {
      /* ignore */
    }
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (isUiLabProductConsentScenario(raw)) return raw;
    } catch {
      /* ignore */
    }
  }
  return "already_accepted_no_flash";
}

export function setUiLabProductConsentScenario(scenario: UiLabProductConsentScenario): void {
  if (!isUiLabMode() || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, scenario);
    // Changing scenario resets the session overlay so demos stay deterministic.
    scenarioGeneration += 1;
    clearUiLabAcceptedScopeOverlay();
    window.dispatchEvent(new Event("alta:product-consent-scenario"));
  } catch {
    /* ignore */
  }
}

export const UI_LAB_PRODUCT_CONSENT_OPTIONS: Array<{
  value: UiLabProductConsentScenario;
  label: string;
}> = [
  { value: "already_accepted_no_flash", label: "Already accepted — no flash" },
  { value: "bank_first_visit", label: "First Bank visit" },
  { value: "bank_current", label: "Returning Bank — current" },
  { value: "bank_terms_updated", label: "Bank terms updated" },
  { value: "terminal_first_visit", label: "First Terminal visit" },
  { value: "terminal_reacceptance", label: "Terminal reacceptance" },
  { value: "card_missing_bank_and_card", label: "Card route — Bank + Card" },
  { value: "lending_missing_bank_and_lending", label: "Lending — Bank + Lending" },
  { value: "alta_pay_missing_pay_only", label: "Alta Pay — Pay only" },
  { value: "funding_missing_terminal", label: "Funding — Terminal only" },
  { value: "funding_missing_both", label: "Funding — Bank + Terminal" },
  { value: "cardholder_view_ok_new_blocked", label: "Cardholder view OK / new blocked" },
  { value: "borrower_view_ok_new_blocked", label: "Borrower view OK / new blocked" },
  { value: "commercial_company_a_ok_b_missing", label: "Company A OK / B missing" },
  { value: "commercial_unauthorized", label: "Unauthorized company member" },
  { value: "consent_server_error", label: "Consent server error" },
  { value: "consent_concurrent", label: "Concurrent acceptance" },
  { value: "legal_links_preserve", label: "Legal links preserve progress" },
  { value: "mobile_consent_sheet", label: "Mobile consent sheet" },
  { value: "marketing_ungated", label: "Marketing never gated" },
  { value: "internal_ungated", label: "Internal never customer-gated" },
];

type AcceptedMap = Partial<Record<LegalConsentScopeId, boolean | "update">>;

function scenarioAcceptedMap(
  scenario: UiLabProductConsentScenario,
  companyId?: string | null,
): AcceptedMap {
  const allCurrent: AcceptedMap = {
    CORE: true,
    BANK: true,
    TERMINAL: true,
    ALTA_PAY: true,
    ALTA_CARD: true,
    LENDING: true,
    COMMERCIAL: true,
  };

  switch (scenario) {
    case "bank_first_visit":
    case "mobile_consent_sheet":
    case "legal_links_preserve":
      return { ...allCurrent, BANK: false };
    case "bank_current":
    case "already_accepted_no_flash":
    case "marketing_ungated":
    case "internal_ungated":
      return allCurrent;
    case "bank_terms_updated":
      return { ...allCurrent, BANK: "update" };
    case "terminal_first_visit":
      return { ...allCurrent, TERMINAL: false };
    case "terminal_reacceptance":
      return { ...allCurrent, TERMINAL: "update" };
    case "card_missing_bank_and_card":
      return { ...allCurrent, BANK: false, ALTA_CARD: false };
    case "lending_missing_bank_and_lending":
      return { ...allCurrent, BANK: false, LENDING: false };
    case "alta_pay_missing_pay_only":
      return { ...allCurrent, BANK: true, ALTA_PAY: false };
    case "funding_missing_terminal":
      return { ...allCurrent, BANK: true, TERMINAL: false };
    case "funding_missing_both":
      return { ...allCurrent, BANK: false, TERMINAL: false };
    case "cardholder_view_ok_new_blocked":
      return { ...allCurrent, ALTA_CARD: false };
    case "borrower_view_ok_new_blocked":
      return { ...allCurrent, LENDING: false };
    case "commercial_company_a_ok_b_missing":
      if (companyId === "company-b" || companyId?.includes("b")) {
        return { ...allCurrent, COMMERCIAL: false };
      }
      return allCurrent;
    case "commercial_unauthorized":
      return { ...allCurrent, COMMERCIAL: false };
    case "consent_server_error":
    case "consent_concurrent":
      return { ...allCurrent, BANK: false };
    default:
      return allCurrent;
  }
}

function mockPresentation(
  scope: LegalConsentScopeId,
  opts: {
    isUpdate?: boolean;
    companyName?: string | null;
    sequence?: { index: number; total: number } | null;
  },
) {
  if (scope === "CORE") throw new Error("CORE_NOT_PRODUCT");
  const docs = resolveConsentBundleDocuments(getConsentBundleDefinition(scope));
  let controlGroups = getConsentControlGroups(scope);
  if (scope === "COMMERCIAL" && opts.companyName) {
    controlGroups = controlGroups.map((g) =>
      g.kind === "authority"
        ? {
            ...g,
            label: `I confirm that I am authorized to accept these terms on behalf of ${opts.companyName}.`,
          }
        : g,
    );
  }

  return {
    scope,
    title: humanizeConsentScope(scope),
    headline: opts.isUpdate ? "Terms updated" : `First use of ${humanizeConsentScope(scope)}`,
    explanation: opts.isUpdate
      ? "Some required documents have changed. Review the updates and accept the current versions to continue."
      : `Review and accept the applicable ${humanizeConsentScope(scope)} documents to continue.`,
    virtualEconomyDisclaimer:
      "Alta operates a virtual economy for entertainment and simulation. These terms do not create real-world banking, brokerage, or lending relationships.",
    isUpdate: Boolean(opts.isUpdate),
    updateHeadline: "Terms updated",
    companyName: opts.companyName ?? null,
    controlGroups,
    documents: docs.map((doc) => ({
      documentId: doc.documentId,
      title: doc.title,
      version: doc.version,
      publicPath: doc.publicPath,
      acceptanceType: doc.acceptanceType,
      contentHash: "ui-lab-hash",
      changed: Boolean(opts.isUpdate),
      previousVersion: opts.isUpdate ? "0.9" : null,
    })),
    sequence: opts.sequence ?? null,
  };
}

export function getUiLabProductConsentGateState(input: {
  scopes: LegalConsentScopeId[];
  companyId?: string | null;
  companyName?: string | null;
  uiLabScenario?: string;
  /** When provided (browser → server), this session overlay is authoritative. */
  uiLabAcceptedOverlay?: UiLabAcceptedOverlay | null;
}) {
  const scenario = isUiLabProductConsentScenario(input.uiLabScenario)
    ? input.uiLabScenario
    : getUiLabProductConsentScenario();

  if (scenario === "marketing_ungated" || scenario === "internal_ungated") {
    return { missingScopes: [], sequence: [], current: null };
  }

  const baseMap = scenarioAcceptedMap(scenario, input.companyId);
  const overlay =
    input.uiLabAcceptedOverlay !== undefined
      ? input.uiLabAcceptedOverlay
      : getUiLabAcceptedOverlaySnapshot(scenario);
  const map = applyAcceptedOverlay(baseMap, input.companyId, overlay);
  const scenarioMissingScopes = input.scopes.filter((scope) => {
    const state = baseMap[scope];
    return state === false || state === "update";
  });
  const missingScopes = input.scopes.filter((scope) => {
    const state = map[scope];
    return state === false || state === "update";
  });
  const sequence = buildConsentSequence(missingScopes, input.companyId ?? undefined);
  const first = sequence[0];
  if (!first) {
    return { missingScopes: [], sequence: [], current: null };
  }

  const isUpdate = map[first.scope] === "update";
  const progressIndex = scenarioMissingScopes.indexOf(first.scope);
  const sequenceProgress =
    progressIndex >= 0 && scenarioMissingScopes.length > 1
      ? { index: progressIndex + 1, total: scenarioMissingScopes.length }
      : { index: first.index, total: first.total };

  return {
    missingScopes,
    sequence,
    current: mockPresentation(first.scope, {
      isUpdate,
      companyName: input.companyName,
      sequence: sequenceProgress,
    }),
  };
}

export function getUiLabProductConsentPresentation(input: {
  scope: LegalConsentScopeId;
  companyId?: string | null;
  companyName?: string | null;
  sequenceIndex?: number;
  sequenceTotal?: number;
  uiLabScenario?: string;
}) {
  const scenario = isUiLabProductConsentScenario(input.uiLabScenario)
    ? input.uiLabScenario
    : getUiLabProductConsentScenario();
  const map = scenarioAcceptedMap(scenario, input.companyId);
  return mockPresentation(input.scope, {
    isUpdate: map[input.scope] === "update",
    companyName: input.companyName,
    sequence:
      input.sequenceIndex && input.sequenceTotal
        ? { index: input.sequenceIndex, total: input.sequenceTotal }
        : null,
  });
}

export function mockUiLabProductConsentSubmit(
  input: {
    scope: LegalConsentScopeId;
    sourceSite: SiteKey;
    companyId?: string | null;
    authorityConfirmed?: boolean;
    acceptedControlIds: string[];
  },
  uiLabScenario?: string,
) {
  const scenario = isUiLabProductConsentScenario(uiLabScenario)
    ? uiLabScenario
    : getUiLabProductConsentScenario();

  if (scenario === "consent_server_error") {
    throw new Error("CONSENT_RECORDING_FAILED");
  }
  if (scenario === "commercial_unauthorized") {
    throw new Error("CONSENT_AUTHORITY_FORBIDDEN");
  }

  const groups = getConsentControlGroups(input.scope);
  for (const group of groups) {
    if (!input.acceptedControlIds.includes(group.id)) {
      throw new Error("CONSENT_CONTROLS_INCOMPLETE");
    }
  }

  // Persist mid-sequence acceptance in session so Bank → Card/Lending/funding advances.
  recordUiLabAcceptedScope(input.scope, input.companyId, scenario);

  const docs = resolveConsentBundleDocuments(getConsentBundleDefinition(input.scope));
  return {
    scope: input.scope,
    created: scenario === "consent_concurrent" ? 0 : docs.length,
    alreadyComplete: scenario === "consent_concurrent",
    subjectKey:
      input.scope === "COMMERCIAL" && input.companyId
        ? `company:${input.companyId}`
        : "user:ui-lab",
    documents: docs.map((d) => ({ ...d, contentHash: "ui-lab-hash" })),
    status: {
      scope: input.scope,
      enforced: true,
      complete: true,
      requiresReacceptance: false,
      subjectKey: "user:ui-lab",
      subjectType: "USER" as const,
      companyId: input.companyId ?? null,
      documents: docs.map((d) => ({
        documentId: d.documentId,
        title: d.title,
        version: d.version,
        acceptanceType: d.acceptanceType,
        contentHash: "ui-lab-hash",
        accepted: true,
        acceptedVersion: d.version,
        acceptedAt: new Date().toISOString(),
        acceptedHash: "ui-lab-hash",
      })),
    },
  };
}
