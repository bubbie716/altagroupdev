/**
 * Server-authoritative SHA-256 hashing of legal document bodies.
 * Hashes prove which exact content version was accepted without storing the body.
 */
import { createHash } from "node:crypto";

export async function hashLegalDocumentContent(body: string): Promise<string> {
  return hashLegalDocumentContentSync(body);
}

export function hashLegalDocumentContentSync(body: string): string {
  const normalized = body.replace(/\r\n/g, "\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
