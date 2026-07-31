/**
 * Detect legal document content changes that lack a corresponding version bump.
 * Used by tests/CI — does not mutate registry.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LEGAL_DOCUMENTS } from "@/lib/legal/legal-document-registry";
import { LEGAL_CONSENT_SCOPES } from "@/lib/legal/consent-scopes";
import {
  getConsentBundleDefinition,
  resolveConsentBundleDocuments,
} from "@/lib/legal/legal-consent-bundle";

const CONTENT_DIR = join(process.cwd(), "src/content/legal-docs");

export function normalizeLegalBody(body: string): string {
  return body.replace(/\r\n/g, "\n").trim();
}

export function hashLegalBodySync(body: string): string {
  return createHash("sha256").update(normalizeLegalBody(body), "utf8").digest("hex");
}

export function findLegalMarkdownPath(documentId: string): string | null {
  if (!existsSync(CONTENT_DIR)) return null;
  const files = readdirSync(CONTENT_DIR);
  const match = files.find((f) => f.startsWith(`${documentId}-`) && f.endsWith(".md"));
  return match ? join(CONTENT_DIR, match) : null;
}

/**
 * Returns document IDs whose on-disk content hash differs from a previously recorded
 * (version, hash) pair without a version change.
 */
export function detectContentChangedWithoutVersionBump(
  baseline: Record<string, { version: string; hash: string }>,
): Array<{ documentId: string; registryVersion: string; baselineVersion: string }> {
  const mismatches: Array<{
    documentId: string;
    registryVersion: string;
    baselineVersion: string;
  }> = [];

  for (const doc of LEGAL_DOCUMENTS) {
    const prior = baseline[doc.id];
    if (!prior) continue;
    const path = findLegalMarkdownPath(doc.id);
    if (!path) continue;
    const body = readFileSync(path, "utf8");
    const hash = hashLegalBodySync(body);
    if (prior.version === doc.version && prior.hash !== hash) {
      mismatches.push({
        documentId: doc.id,
        registryVersion: doc.version,
        baselineVersion: prior.version,
      });
    }
  }

  return mismatches;
}

/** Assert every consent-bundle document exists in the registry with a resolvable path. */
export function assertAllConsentBundleDocumentsResolvable(): string[] {
  const missing: string[] = [];
  for (const scope of LEGAL_CONSENT_SCOPES) {
    const docs = resolveConsentBundleDocuments(getConsentBundleDefinition(scope));
    for (const doc of docs) {
      if (!doc.version) missing.push(`${scope}:${doc.documentId}:no-version`);
      const path = findLegalMarkdownPath(doc.documentId);
      if (!path) missing.push(`${scope}:${doc.documentId}:no-markdown`);
    }
  }
  return missing;
}
