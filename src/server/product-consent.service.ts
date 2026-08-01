/**
 * Server-side product consent guards and acceptance orchestration.
 */
import type { AltaUser } from "@/lib/auth/types";
import { canAcceptCompanyLegalTerms } from "@/lib/auth/permissions";
import type { LegalConsentScopeId } from "@/lib/legal/consent-scopes";
import { humanizeConsentScope } from "@/lib/legal/consent-scopes";
import {
  getConsentControlGroups,
  resolveConsentBundleDocuments,
  getConsentBundleDefinition,
} from "@/lib/legal/legal-consent-bundle";
import {
  buildConsentSequence,
  getActionConsentRequirement,
  type ProductConsentActionKey,
} from "@/lib/legal/product-consent-requirements";
import {
  ConsentRequiredError,
  isConsentRequiredError,
} from "@/lib/legal/consent-required-error";
import {
  getConsentBundleStatus,
  hasAcceptedCurrentConsentBundle,
  recordConsentBundle,
  resolveCurrentConsentBundle,
  resolveMissingConsentScopes,
  type ConsentBundleStatus,
  type ResolvedConsentDocumentWithHash,
} from "@/server/legal-consent.service";
import { meetsCurrentOnboardingRequirement } from "@/lib/onboarding/onboarding-steps";

export { ConsentRequiredError, isConsentRequiredError };

export type ProductConsentPresentation = {
  scope: LegalConsentScopeId;
  title: string;
  headline: string;
  explanation: string;
  virtualEconomyDisclaimer: string;
  isUpdate: boolean;
  updateHeadline: string;
  companyName: string | null;
  controlGroups: ReturnType<typeof getConsentControlGroups>;
  documents: Array<{
    documentId: string;
    title: string;
    version: string;
    publicPath: string;
    acceptanceType: string;
    contentHash: string;
    changed: boolean;
    previousVersion: string | null;
  }>;
  sequence: { index: number; total: number } | null;
};

const PRODUCT_COPY: Record<
  Exclude<LegalConsentScopeId, "CORE">,
  { title: string; headline: string; explanation: string }
> = {
  BANK: {
    title: "Alta Bank",
    headline: "First use of Alta Bank",
    explanation:
      "Before using Alta Bank, review and accept the deposit account terms that apply to your accounts.",
  },
  TERMINAL: {
    title: "Alta Terminal",
    headline: "First use of Alta Terminal",
    explanation:
      "Before using Alta Terminal, review and accept the customer agreement and trading terms.",
  },
  CRYPTO: {
    title: "Alta Terminal Crypto",
    headline: "First use of Alta Terminal Crypto",
    explanation:
      "Before trading fictional crypto assets on Alta Terminal, acknowledge the crypto trading and custody disclosure.",
  },
  ALTA_PAY: {
    title: "Alta Pay",
    headline: "First use of Alta Pay",
    explanation: "Before sending an Alta Pay payment, review and accept the Alta Pay Terms.",
  },
  ALTA_CARD: {
    title: "Alta Card",
    headline: "Alta Card terms",
    explanation:
      "Before applying for or activating an Alta Card, acknowledge the general card terms template. Finalized card-specific terms may still be required before activation of an approved card.",
  },
  LENDING: {
    title: "Lending",
    headline: "Lending terms",
    explanation:
      "Before beginning a lending application, acknowledge the general lending agreement template. No loan exists until an offer or final agreement is presented and accepted.",
  },
  COMMERCIAL: {
    title: "Commercial",
    headline: "Commercial and merchant terms",
    explanation:
      "Before enabling or using Commercial and merchant features for this company, an authorized representative must accept the applicable business and merchant agreements.",
  },
};

const VIRTUAL_ECONOMY_DISCLAIMER =
  "Alta operates a virtual economy for entertainment and simulation. These terms do not create real-world banking, brokerage, or lending relationships.";

export async function buildProductConsentPresentation(input: {
  userId: string;
  scope: LegalConsentScopeId;
  companyId?: string | null;
  companyName?: string | null;
  sequence?: { index: number; total: number } | null;
}): Promise<ProductConsentPresentation> {
  if (input.scope === "CORE") {
    throw new Error("CORE_CONSENT_NOT_PRODUCT");
  }

  const status = await getConsentBundleStatus(input.userId, input.scope, {
    companyId: input.companyId,
  });
  const bundle = await resolveCurrentConsentBundle(input.scope);
  const copy = PRODUCT_COPY[input.scope];
  const isUpdate = status.requiresReacceptance;

  const documents = bundle.documents.map((doc) => {
    const statusDoc = status.documents.find((d) => d.documentId === doc.documentId);
    const changed = Boolean(
      statusDoc &&
        !statusDoc.accepted &&
        (statusDoc.acceptedVersion || statusDoc.acceptedHash),
    );
    return {
      documentId: doc.documentId,
      title: doc.title,
      version: doc.version,
      publicPath: doc.publicPath,
      acceptanceType: doc.acceptanceType,
      contentHash: doc.contentHash,
      changed,
      previousVersion: statusDoc?.acceptedVersion ?? null,
    };
  });

  let controlGroups = getConsentControlGroups(input.scope);
  if (input.scope === "COMMERCIAL" && input.companyName) {
    controlGroups = controlGroups.map((group) =>
      group.kind === "authority"
        ? {
            ...group,
            label: `I confirm that I am authorized to accept these terms on behalf of ${input.companyName}.`,
          }
        : group,
    );
  }

  return {
    scope: input.scope,
    title: copy.title,
    headline: isUpdate ? "Terms updated" : copy.headline,
    explanation: isUpdate
      ? "Some required documents have changed. Review the updates and accept the current versions to continue."
      : copy.explanation,
    virtualEconomyDisclaimer: VIRTUAL_ECONOMY_DISCLAIMER,
    isUpdate,
    updateHeadline: "Terms updated",
    companyName: input.companyName ?? null,
    controlGroups,
    documents,
    sequence: input.sequence ?? null,
  };
}

/**
 * Require current product consent for a mutation. Throws ConsentRequiredError with missing scopes.
 * Core onboarding + Minecraft verification must already be complete.
 */
export async function requireProductConsent(
  user: AltaUser,
  scopes: readonly LegalConsentScopeId[],
  options?: { companyId?: string | null },
): Promise<void> {
  if (!meetsCurrentOnboardingRequirement(user)) {
    throw new ConsentRequiredError(["CORE"], options?.companyId);
  }

  const missing = await resolveMissingConsentScopes(user.id, scopes, options);
  if (missing.length > 0) {
    throw new ConsentRequiredError(missing, options?.companyId);
  }
}

export async function requireProductConsentForAction(
  user: AltaUser,
  action: ProductConsentActionKey,
  options?: { companyId?: string | null },
): Promise<void> {
  const requirement = getActionConsentRequirement(action);
  if (requirement.companyScoped && !options?.companyId) {
    throw new Error("CONSENT_COMPANY_REQUIRED");
  }
  if (requirement.companyScoped && options?.companyId) {
    await requireCompanyProductConsent(user, options.companyId, requirement.scopes);
    return;
  }
  await requireProductConsent(user, requirement.scopes, options);
}

/**
 * Company-scoped commercial consent: requires BANK (user) + COMMERCIAL (company),
 * and owner/executive authority to accept or use binding features.
 */
export async function requireCompanyProductConsent(
  user: AltaUser,
  companyId: string,
  scopes: readonly LegalConsentScopeId[],
): Promise<void> {
  if (!meetsCurrentOnboardingRequirement(user)) {
    throw new ConsentRequiredError(["CORE"], companyId);
  }

  const missing: LegalConsentScopeId[] = [];
  for (const scope of scopes) {
    if (scope === "COMMERCIAL") {
      if (!canAcceptCompanyLegalTerms(user, { companyId })) {
        throw new Error("CONSENT_AUTHORITY_FORBIDDEN");
      }
      const ok = await hasAcceptedCurrentConsentBundle(user.id, "COMMERCIAL", { companyId });
      if (!ok) missing.push("COMMERCIAL");
      continue;
    }
    const ok = await hasAcceptedCurrentConsentBundle(user.id, scope);
    if (!ok) missing.push(scope);
  }

  if (missing.length > 0) {
    throw new ConsentRequiredError(missing, companyId);
  }
}

export type RecordProductConsentInput = {
  scope: LegalConsentScopeId;
  sourceSite: string;
  companyId?: string | null;
  authorityConfirmed?: boolean;
  /** Client-reported control ids (validated; versions/hashes ignored). */
  acceptedControlIds: string[];
};

export type RecordProductConsentResult = {
  scope: LegalConsentScopeId;
  created: number;
  alreadyComplete: boolean;
  subjectKey: string;
  documents: ResolvedConsentDocumentWithHash[];
  status: ConsentBundleStatus;
};

export async function submitProductConsent(
  user: AltaUser,
  input: RecordProductConsentInput,
): Promise<RecordProductConsentResult> {
  if (!meetsCurrentOnboardingRequirement(user)) {
    throw new Error("ONBOARDING_REQUIRED");
  }
  if (input.scope === "CORE") {
    throw new Error("USE_CORE_ONBOARDING");
  }

  const groups = getConsentControlGroups(input.scope);
  const requiredIds = groups.map((g) => g.id);
  for (const id of requiredIds) {
    if (!input.acceptedControlIds.includes(id)) {
      throw new Error("CONSENT_CONTROLS_INCOMPLETE");
    }
  }

  if (input.scope === "COMMERCIAL") {
    if (!input.companyId) throw new Error("CONSENT_COMPANY_REQUIRED");
    if (!canAcceptCompanyLegalTerms(user, { companyId: input.companyId })) {
      throw new Error("CONSENT_AUTHORITY_FORBIDDEN");
    }
    if (!input.authorityConfirmed && !input.acceptedControlIds.includes("authority")) {
      throw new Error("CONSENT_AUTHORITY_REQUIRED");
    }
  }

  const result = await recordConsentBundle({
    userId: user.id,
    scope: input.scope,
    sourceSite: input.sourceSite,
    companyId: input.companyId,
    authorityConfirmed:
      input.scope === "COMMERCIAL"
        ? Boolean(input.authorityConfirmed || input.acceptedControlIds.includes("authority"))
        : undefined,
  });

  void writeProductConsentAudit(user, input, result).catch((error) => {
    console.error("[product-consent] audit write failed", error);
  });

  const status = await getConsentBundleStatus(user.id, input.scope, {
    companyId: input.companyId,
  });

  return {
    scope: input.scope,
    created: result.created,
    alreadyComplete: result.alreadyComplete,
    subjectKey: result.subjectKey,
    documents: result.documents,
    status,
  };
}

async function writeProductConsentAudit(
  user: AltaUser,
  input: RecordProductConsentInput,
  result: Awaited<ReturnType<typeof recordConsentBundle>>,
): Promise<void> {
  const { writeAuditLog } = await import("@/server/audit.service");
  const isUpdate = result.documents.some(() => !result.alreadyComplete) && result.created > 0;
  const action = resolveAuditAction(input.scope, !result.alreadyComplete && result.created > 0);

  await writeAuditLog({
    actorUserId: user.id,
    targetUserId: user.id,
    entityType: "LEGAL_ACCEPTANCE",
    entityId: input.companyId ?? user.id,
    action,
    description: `${humanizeConsentScope(input.scope)} terms ${
      result.alreadyComplete ? "already accepted" : "accepted"
    }`,
    metadata: {
      source: "SYSTEM",
      sourceSite: input.sourceSite,
      severity: "info",
      scope: input.scope,
      subjectKey: result.subjectKey,
      companyId: input.companyId ?? null,
      documentIds: result.documents.map((d) => d.documentId),
      documentVersions: result.documents.map((d) => d.version),
      reacceptance: Boolean(isUpdate && !result.alreadyComplete),
      authorityConfirmed: input.scope === "COMMERCIAL" ? true : undefined,
    },
  });
}

function resolveAuditAction(scope: LegalConsentScopeId, created: boolean): string {
  if (!created) {
    return `PRODUCT_CONSENT_IDEMPOTENT_${scope}`;
  }
  switch (scope) {
    case "BANK":
      return "BANK_TERMS_ACCEPTED";
    case "TERMINAL":
      return "TERMINAL_TERMS_ACCEPTED";
    case "ALTA_PAY":
      return "ALTA_PAY_TERMS_ACCEPTED";
    case "ALTA_CARD":
      return "ALTA_CARD_TERMS_ACKNOWLEDGED";
    case "LENDING":
      return "LENDING_TERMS_ACKNOWLEDGED";
    case "COMMERCIAL":
      return "COMMERCIAL_TERMS_ACCEPTED";
    case "CORE":
      return "ONBOARDING_CORE_LEGAL_ACCEPTED";
  }
}

export async function loadProductConsentGateState(input: {
  user: AltaUser;
  scopes: LegalConsentScopeId[];
  companyId?: string | null;
  companyName?: string | null;
}): Promise<{
  missingScopes: LegalConsentScopeId[];
  sequence: ReturnType<typeof buildConsentSequence>;
  current: ProductConsentPresentation | null;
}> {
  const missingScopes = await resolveMissingConsentScopes(input.user.id, input.scopes, {
    companyId: input.companyId,
  });
  const sequence = buildConsentSequence(missingScopes, input.companyId ?? undefined);
  const first = sequence[0];
  if (!first) {
    return { missingScopes: [], sequence: [], current: null };
  }

  const current = await buildProductConsentPresentation({
    userId: input.user.id,
    scope: first.scope,
    companyId: first.companyId,
    companyName: input.companyName,
    sequence: { index: first.index, total: first.total },
  });

  return { missingScopes, sequence, current };
}

/** Lightweight registry/content integrity check used by tests. */
export function assertBundleDocumentsExistInRegistry(scope: LegalConsentScopeId): string[] {
  const definition = getConsentBundleDefinition(scope);
  return resolveConsentBundleDocuments(definition).map((d) => d.documentId);
}
