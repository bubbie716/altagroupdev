/**
 * Internal read models for product consent status (customer + company).
 * Staff cannot fabricate consent. Terminal-only staff do not receive Bank legal detail.
 */
import type { AltaUser } from "@/lib/auth/types";
import {
  canAccessBankInternal,
  canAccessTerminalInternal,
  isCorporateAdmin,
} from "@/lib/auth/permissions";
import {
  LEGAL_CONSENT_SCOPES,
  humanizeAcceptanceType,
  humanizeConsentScope,
  type LegalConsentScopeId,
} from "@/lib/legal/consent-scopes";
import { getLegalDocument } from "@/lib/legal/legal-document-registry";
import { prisma } from "@/server/db";
import {
  getConsentBundleStatus,
  listCompanyAcceptanceHistory,
  listUserAcceptanceHistory,
} from "@/server/legal-consent.service";

export type ScopeConsentSummary = {
  scope: LegalConsentScopeId;
  label: string;
  status: "Current" | "Not accepted" | "Update required";
  currentVersions: string[];
  acceptedVersions: string[];
  acceptedAt: string | null;
  acceptanceSemantics: string[];
  sourceSite: string | null;
  companyId: string | null;
  companyName: string | null;
  subjectKey: string | null;
  actorUserId: string | null;
  technical: Array<{ documentId: string; contentHash: string; version: string }>;
};

export type CustomerProductConsentSummary = {
  scopes: ScopeConsentSummary[];
  commercialActingFor: ScopeConsentSummary[];
};

export type CompanyCommercialConsentSummary = {
  companyId: string;
  companyName: string;
  commercial: ScopeConsentSummary;
  history: Array<{
    documentId: string;
    title: string;
    version: string;
    acceptanceType: string;
    actorUserId: string;
    acceptedAt: string;
    sourceSite: string;
    supersededAt: string | null;
  }>;
};

function statusLabel(
  complete: boolean,
  requiresReacceptance: boolean,
): ScopeConsentSummary["status"] {
  if (complete) return "Current";
  if (requiresReacceptance) return "Update required";
  return "Not accepted";
}

function canSeeScope(actor: AltaUser, scope: LegalConsentScopeId): boolean {
  if (isCorporateAdmin(actor) || canAccessBankInternal(actor)) return true;
  if (canAccessTerminalInternal(actor)) {
    return scope === "CORE" || scope === "TERMINAL";
  }
  return false;
}

export async function getCustomerProductConsentSummary(
  userId: string,
  actor: AltaUser,
): Promise<CustomerProductConsentSummary> {
  const visibleScopes = LEGAL_CONSENT_SCOPES.filter((scope) => canSeeScope(actor, scope));

  const scopes: ScopeConsentSummary[] = [];
  for (const scope of visibleScopes) {
    if (scope === "COMMERCIAL") continue;
    const bundle = await getConsentBundleStatus(userId, scope);
    const history = await listUserAcceptanceHistory(userId, { scope, limit: 20 });
    const active = history.filter((h) => !h.supersededAt && !h.withdrawnAt);
    scopes.push({
      scope,
      label: humanizeConsentScope(scope),
      status: statusLabel(bundle.complete, bundle.requiresReacceptance),
      currentVersions: bundle.documents.map((d) => `${d.documentId} v${d.version}`),
      acceptedVersions: active.map((h) => `${h.documentId} v${h.documentVersion}`),
      acceptedAt: active[0]?.acceptedAt ?? null,
      acceptanceSemantics: active.map((h) => humanizeAcceptanceType(h.acceptanceType)),
      sourceSite: active[0]?.sourceSite ?? null,
      companyId: null,
      companyName: null,
      subjectKey: bundle.subjectKey,
      actorUserId: active[0]?.actorUserId ?? null,
      technical: bundle.documents.map((d) => ({
        documentId: d.documentId,
        contentHash: d.contentHash,
        version: d.version,
      })),
    });
  }

  const commercialActingFor: ScopeConsentSummary[] = [];
  if (visibleScopes.includes("COMMERCIAL")) {
    const companyAcceptances = await prisma.legalAcceptance.findMany({
      where: {
        userId,
        consentScope: "COMMERCIAL",
        subjectType: "COMPANY",
      },
      distinct: ["companyId"],
      orderBy: { acceptedAt: "desc" },
      select: { companyId: true },
    });

    for (const row of companyAcceptances) {
      if (!row.companyId) continue;
      const company = await prisma.company.findUnique({
        where: { id: row.companyId },
        select: { id: true, name: true },
      });
      if (!company) continue;
      const bundle = await getConsentBundleStatus(userId, "COMMERCIAL", {
        companyId: company.id,
      });
      const history = await listCompanyAcceptanceHistory(company.id, {
        scope: "COMMERCIAL",
        limit: 20,
      });
      const active = history.filter((h) => !h.supersededAt && !h.withdrawnAt);
      commercialActingFor.push({
        scope: "COMMERCIAL",
        label: `${humanizeConsentScope("COMMERCIAL")} · ${company.name}`,
        status: statusLabel(bundle.complete, bundle.requiresReacceptance),
        currentVersions: bundle.documents.map((d) => `${d.documentId} v${d.version}`),
        acceptedVersions: active.map((h) => `${h.documentId} v${h.documentVersion}`),
        acceptedAt: active[0]?.acceptedAt ?? null,
        acceptanceSemantics: active.map((h) => humanizeAcceptanceType(h.acceptanceType)),
        sourceSite: active[0]?.sourceSite ?? null,
        companyId: company.id,
        companyName: company.name,
        subjectKey: bundle.subjectKey,
        actorUserId: active[0]?.actorUserId ?? null,
        technical: bundle.documents.map((d) => ({
          documentId: d.documentId,
          contentHash: d.contentHash,
          version: d.version,
        })),
      });
    }
  }

  return { scopes, commercialActingFor };
}

export async function getCompanyCommercialConsentSummary(
  companyId: string,
): Promise<CompanyCommercialConsentSummary> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new Error("COMPANY_NOT_FOUND");

  // Status is company-subject — use a placeholder actor id only for resolution context.
  // Bundle status queries by subjectKey/companyId, not actor.
  const bundle = await getConsentBundleStatus("system", "COMMERCIAL", { companyId });
  // getConsentBundleStatus for COMMERCIAL uses company subject — userId unused for lookup.
  // Fix: call with any userId since subject is company-scoped.
  const history = await listCompanyAcceptanceHistory(companyId, {
    scope: "COMMERCIAL",
    limit: 40,
  });
  const active = history.filter((h) => !h.supersededAt && !h.withdrawnAt);

  return {
    companyId: company.id,
    companyName: company.name,
    commercial: {
      scope: "COMMERCIAL",
      label: humanizeConsentScope("COMMERCIAL"),
      status: statusLabel(bundle.complete, bundle.requiresReacceptance),
      currentVersions: bundle.documents.map((d) => `${d.documentId} v${d.version}`),
      acceptedVersions: active.map((h) => `${h.documentId} v${h.documentVersion}`),
      acceptedAt: active[0]?.acceptedAt ?? null,
      acceptanceSemantics: active.map((h) => humanizeAcceptanceType(h.acceptanceType)),
      sourceSite: active[0]?.sourceSite ?? null,
      companyId: company.id,
      companyName: company.name,
      subjectKey: bundle.subjectKey,
      actorUserId: active[0]?.actorUserId ?? null,
      technical: bundle.documents.map((d) => ({
        documentId: d.documentId,
        contentHash: d.contentHash,
        version: d.version,
      })),
    },
    history: history.map((row) => ({
      documentId: row.documentId,
      title: getLegalDocument(row.documentId)?.title ?? row.documentId,
      version: row.documentVersion,
      acceptanceType: humanizeAcceptanceType(row.acceptanceType),
      actorUserId: row.actorUserId,
      acceptedAt: row.acceptedAt,
      sourceSite: row.sourceSite,
      supersededAt: row.supersededAt,
    })),
  };
}
