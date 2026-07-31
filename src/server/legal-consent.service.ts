/**
 * Legal consent recording and resolution.
 * Server resolves current document versions/hashes — never trusts the browser.
 * Acceptances are append-only: prior rows are never rewritten as a new acceptance.
 */
import type {
  LegalAcceptanceType,
  LegalConsentScope,
  LegalConsentSubjectType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { getLegalDoc } from "@/lib/governance/legal-docs-catalog";
import { hashLegalDocumentContent } from "@/lib/legal/legal-content-hash";
import {
  getConsentBundleDefinition,
  resolveConsentBundleDocuments,
  type ConsentBundleDefinition,
  type ResolvedConsentDocument,
} from "@/lib/legal/legal-consent-bundle";
import type { LegalConsentScopeId, LegalAcceptanceTypeId } from "@/lib/legal/consent-scopes";
import { isConsentScopeEnforced } from "@/lib/legal/legal-consent-bundle";
import {
  companyConsentSubjectKey,
  consentSubjectKey,
  type LegalConsentSubject,
  userConsentSubjectKey,
} from "@/lib/legal/legal-consent-subject";

export type ResolvedConsentDocumentWithHash = ResolvedConsentDocument & {
  contentHash: string;
};

export type ConsentBundleStatus = {
  scope: LegalConsentScopeId;
  enforced: boolean;
  complete: boolean;
  requiresReacceptance: boolean;
  subjectKey: string;
  subjectType: "USER" | "COMPANY";
  companyId: string | null;
  documents: Array<{
    documentId: string;
    title: string;
    version: string;
    acceptanceType: LegalAcceptanceTypeId;
    contentHash: string;
    accepted: boolean;
    acceptedVersion: string | null;
    acceptedAt: string | null;
    acceptedHash: string | null;
  }>;
};

export type LegalAcceptanceHistoryRow = {
  id: string;
  documentId: string;
  documentVersion: string;
  contentHash: string;
  acceptanceType: LegalAcceptanceTypeId;
  consentScope: LegalConsentScopeId;
  sourceSite: string;
  subjectKey: string;
  subjectType: "USER" | "COMPANY";
  companyId: string | null;
  actorUserId: string;
  acceptedAt: string;
  supersededAt: string | null;
  withdrawnAt: string | null;
};

async function resolveDocumentWithHash(
  doc: ResolvedConsentDocument,
): Promise<ResolvedConsentDocumentWithHash> {
  const content = await getLegalDoc(doc.documentId);
  if (!content) {
    throw new Error(`LEGAL_CONTENT_MISSING:${doc.documentId}`);
  }
  const contentHash = await hashLegalDocumentContent(content.body);
  return { ...doc, contentHash };
}

/** Resolve the current bundle with server-computed content hashes. */
export async function resolveCurrentConsentBundle(
  scope: LegalConsentScopeId,
): Promise<{
  scope: LegalConsentScopeId;
  documents: ResolvedConsentDocumentWithHash[];
}> {
  const definition = getConsentBundleDefinition(scope);
  const resolved = resolveConsentBundleDocuments(definition);
  const documents = await Promise.all(resolved.map(resolveDocumentWithHash));
  return { scope, documents };
}

type AcceptanceRow = {
  documentId: string;
  documentVersion: string;
  contentHash: string;
  acceptanceType: LegalAcceptanceType;
  acceptedAt: Date;
  supersededAt: Date | null;
  withdrawnAt: Date | null;
};

function activeAcceptance(
  rows: AcceptanceRow[],
  documentId: string,
  acceptanceType: LegalAcceptanceTypeId,
  version: string,
  contentHash: string,
): AcceptanceRow | undefined {
  return rows.find(
    (row) =>
      row.documentId === documentId &&
      row.acceptanceType === acceptanceType &&
      row.documentVersion === version &&
      row.contentHash === contentHash &&
      !row.supersededAt &&
      !row.withdrawnAt,
  );
}

function resolveSubjectInput(input: {
  userId: string;
  companyId?: string | null;
  scope: LegalConsentScopeId;
}): { subject: LegalConsentSubject; subjectKey: string; subjectType: LegalConsentSubjectType } {
  if (input.scope === "COMMERCIAL") {
    if (!input.companyId) {
      throw new Error("CONSENT_COMPANY_REQUIRED");
    }
    const subject: LegalConsentSubject = { type: "COMPANY", companyId: input.companyId };
    return {
      subject,
      subjectKey: consentSubjectKey(subject),
      subjectType: "COMPANY",
    };
  }
  const subject: LegalConsentSubject = { type: "USER", userId: input.userId };
  return {
    subject,
    subjectKey: consentSubjectKey(subject),
    subjectType: "USER",
  };
}

/** Determine whether a subject has accepted the current required versions for a scope. */
export async function getConsentBundleStatus(
  userId: string,
  scope: LegalConsentScopeId,
  options?: { companyId?: string | null },
): Promise<ConsentBundleStatus> {
  const { subjectKey, subjectType } = resolveSubjectInput({
    userId,
    companyId: options?.companyId,
    scope,
  });

  const bundle = await resolveCurrentConsentBundle(scope);
  const rows = await prisma.legalAcceptance.findMany({
    where: {
      subjectKey,
      consentScope: scope as LegalConsentScope,
    },
    orderBy: { acceptedAt: "desc" },
  });

  const documents = bundle.documents.map((doc) => {
    const match = activeAcceptance(
      rows,
      doc.documentId,
      doc.acceptanceType,
      doc.version,
      doc.contentHash,
    );
    const latestForDoc = rows.find(
      (r) => r.documentId === doc.documentId && r.acceptanceType === doc.acceptanceType,
    );
    return {
      documentId: doc.documentId,
      title: doc.title,
      version: doc.version,
      acceptanceType: doc.acceptanceType,
      contentHash: doc.contentHash,
      accepted: Boolean(match),
      acceptedVersion: latestForDoc?.documentVersion ?? null,
      acceptedAt: latestForDoc?.acceptedAt.toISOString() ?? null,
      acceptedHash: latestForDoc?.contentHash ?? null,
    };
  });

  const complete = documents.every((d) => d.accepted);
  const requiresReacceptance = documents.some((d) => {
    if (d.accepted) return false;
    return Boolean(d.acceptedVersion) || Boolean(d.acceptedHash);
  });

  return {
    scope,
    enforced: isConsentScopeEnforced(scope),
    complete,
    requiresReacceptance,
    subjectKey,
    subjectType,
    companyId: subjectType === "COMPANY" ? options?.companyId ?? null : null,
    documents,
  };
}

export async function hasAcceptedCurrentConsentBundle(
  userId: string,
  scope: LegalConsentScopeId,
  options?: { companyId?: string | null },
): Promise<boolean> {
  const status = await getConsentBundleStatus(userId, scope, options);
  return status.complete;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Record a consent bundle atomically.
 * Idempotent and append-only:
 * - Matching active rows are left alone.
 * - Reacceptance creates a new row; prior rows are superseded, never rewritten.
 * - Browser-supplied versions/hashes are ignored — server resolves current docs.
 */
export async function recordConsentBundle(input: {
  userId: string;
  scope: LegalConsentScopeId;
  sourceSite: string;
  companyId?: string | null;
  /** Required for COMMERCIAL — confirmed separately in the UI. */
  authorityConfirmed?: boolean;
  tx?: Prisma.TransactionClient;
}): Promise<{
  created: number;
  documents: ResolvedConsentDocumentWithHash[];
  subjectKey: string;
  alreadyComplete: boolean;
}> {
  if (input.scope === "COMMERCIAL" && !input.authorityConfirmed) {
    throw new Error("CONSENT_AUTHORITY_REQUIRED");
  }

  const { subjectKey, subjectType } = resolveSubjectInput({
    userId: input.userId,
    companyId: input.companyId,
    scope: input.scope,
  });

  const run = async (tx: Prisma.TransactionClient) => {
    const bundle = await resolveCurrentConsentBundle(input.scope);
    let created = 0;

    for (const doc of bundle.documents) {
      const existingActive = await tx.legalAcceptance.findFirst({
        where: {
          subjectKey,
          documentId: doc.documentId,
          documentVersion: doc.version,
          acceptanceType: doc.acceptanceType as LegalAcceptanceType,
          contentHash: doc.contentHash,
          supersededAt: null,
          withdrawnAt: null,
        },
      });

      if (existingActive) {
        continue;
      }

      // Supersede older active acceptances for the same subject+document+type.
      // Never rewrite those rows — only set supersession metadata.
      await tx.legalAcceptance.updateMany({
        where: {
          subjectKey,
          documentId: doc.documentId,
          acceptanceType: doc.acceptanceType as LegalAcceptanceType,
          supersededAt: null,
          withdrawnAt: null,
        },
        data: { supersededAt: new Date() },
      });

      try {
        await tx.legalAcceptance.create({
          data: {
            userId: input.userId,
            subjectType: subjectType as LegalConsentSubjectType,
            subjectKey,
            companyId: subjectType === "COMPANY" ? input.companyId ?? null : null,
            documentId: doc.documentId,
            documentVersion: doc.version,
            contentHash: doc.contentHash,
            acceptanceType: doc.acceptanceType as LegalAcceptanceType,
            consentScope: input.scope as LegalConsentScope,
            sourceSite: input.sourceSite,
          },
        });
        created += 1;
      } catch (error) {
        if (isUniqueViolation(error)) {
          // Concurrent acceptance won the race — treat as idempotent success.
          continue;
        }
        throw error;
      }
    }

    return {
      created,
      documents: bundle.documents,
      subjectKey,
      alreadyComplete: created === 0,
    };
  };

  if (input.tx) return run(input.tx);
  return prisma.$transaction(run);
}

export async function listUserAcceptanceHistory(
  userId: string,
  options?: { scope?: LegalConsentScopeId; limit?: number },
): Promise<LegalAcceptanceHistoryRow[]> {
  const rows = await prisma.legalAcceptance.findMany({
    where: {
      OR: [
        { userId },
        { subjectKey: userConsentSubjectKey(userId) },
      ],
      ...(options?.scope ? { consentScope: options.scope as LegalConsentScope } : {}),
    },
    orderBy: { acceptedAt: "desc" },
    take: options?.limit ?? 50,
  });

  return rows.map(mapHistoryRow);
}

export async function listCompanyAcceptanceHistory(
  companyId: string,
  options?: { scope?: LegalConsentScopeId; limit?: number },
): Promise<LegalAcceptanceHistoryRow[]> {
  const rows = await prisma.legalAcceptance.findMany({
    where: {
      subjectKey: companyConsentSubjectKey(companyId),
      ...(options?.scope ? { consentScope: options.scope as LegalConsentScope } : {}),
    },
    orderBy: { acceptedAt: "desc" },
    take: options?.limit ?? 50,
  });

  return rows.map(mapHistoryRow);
}

function mapHistoryRow(row: {
  id: string;
  documentId: string;
  documentVersion: string;
  contentHash: string;
  acceptanceType: LegalAcceptanceType;
  consentScope: LegalConsentScope;
  sourceSite: string;
  subjectKey: string;
  subjectType: LegalConsentSubjectType;
  companyId: string | null;
  userId: string;
  acceptedAt: Date;
  supersededAt: Date | null;
  withdrawnAt: Date | null;
}): LegalAcceptanceHistoryRow {
  return {
    id: row.id,
    documentId: row.documentId,
    documentVersion: row.documentVersion,
    contentHash: row.contentHash,
    acceptanceType: row.acceptanceType as LegalAcceptanceTypeId,
    consentScope: row.consentScope as LegalConsentScopeId,
    sourceSite: row.sourceSite,
    subjectKey: row.subjectKey,
    subjectType: row.subjectType as "USER" | "COMPANY",
    companyId: row.companyId,
    actorUserId: row.userId,
    acceptedAt: row.acceptedAt.toISOString(),
    supersededAt: row.supersededAt?.toISOString() ?? null,
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
  };
}

/** Identify whether reacceptance is required after a material version/hash change. */
export async function requiresConsentReacceptance(
  userId: string,
  scope: LegalConsentScopeId,
  options?: { companyId?: string | null },
): Promise<boolean> {
  const status = await getConsentBundleStatus(userId, scope, options);
  return status.requiresReacceptance || !status.complete;
}

export function assertConsentScopeDefinition(scope: LegalConsentScopeId): ConsentBundleDefinition {
  return getConsentBundleDefinition(scope);
}

/**
 * Resolve missing scopes for a requirement list (ordered).
 * Does not auto-backfill; returns scopes that are incomplete for the subject.
 */
export async function resolveMissingConsentScopes(
  userId: string,
  scopes: readonly LegalConsentScopeId[],
  options?: { companyId?: string | null },
): Promise<LegalConsentScopeId[]> {
  const missing: LegalConsentScopeId[] = [];
  for (const scope of scopes) {
    const ok = await hasAcceptedCurrentConsentBundle(userId, scope, {
      companyId: scope === "COMMERCIAL" ? options?.companyId : undefined,
    });
    if (!ok) missing.push(scope);
  }
  return missing;
}
