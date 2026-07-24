import type { NccApiCredential, NccApiEnvironment } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  hashApiSecret,
  randomHexToken,
  randomToken,
  timingSafeEqualString,
} from "@/server/crypto";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { assertScopesSupported, type NccApiScope } from "@/lib/ncc/ncc-api-scopes";
import { NccApiError } from "@/lib/ncc/ncc-api-errors";

/**
 * Exact token grammar (Sprint 3B.1):
 *   ncc_(live|test)_<hexPrefix>_<secret>
 *
 * - prefix: lowercase hex only (default 12 chars / 48 bits) — never contains `_`
 * - secret: Base64URL (may contain `_` and `-`); parsed as the complete remainder after prefix_
 *
 * Legacy credentials whose prefix contains `_` (pre-3B.1 Base64URL prefixes) are resolved
 * via a dedicated DB lookup on the remainder; new credentials never create such prefixes.
 */
export const NCC_CREDENTIAL_PREFIX_HEX_BYTES = 6;
export const NCC_CREDENTIAL_PREFIX_HEX_LENGTH = NCC_CREDENTIAL_PREFIX_HEX_BYTES * 2;
export const NCC_CREDENTIAL_SECRET_MIN_LENGTH = 16;

const NEW_TOKEN_RE = new RegExp(
  `^ncc_(live|test)_([a-f0-9]{${NCC_CREDENTIAL_PREFIX_HEX_LENGTH}})_([A-Za-z0-9_-]{${NCC_CREDENTIAL_SECRET_MIN_LENGTH},})$`,
);

export type CredentialPublicView = {
  id: string;
  name: string;
  environment: NccApiEnvironment;
  keyPrefix: string;
  scopes: string[];
  status: NccApiCredential["status"];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

export type CredentialCreateResult = CredentialPublicView & {
  /** Raw secret — shown exactly once. */
  secret: string;
  authorizationHint: string;
};

function mapCredential(row: NccApiCredential): CredentialPublicView {
  return {
    id: row.id,
    name: row.name,
    environment: row.environment,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

function envToken(environment: NccApiEnvironment): string {
  return environment === "LIVE" ? "live" : "test";
}

export function formatCredentialBearerToken(
  environment: NccApiEnvironment,
  keyPrefix: string,
  secret: string,
): string {
  return `ncc_${envToken(environment)}_${keyPrefix}_${secret}`;
}

export type ParsedCredentialToken = {
  environment: NccApiEnvironment;
  keyPrefix: string;
  secret: string;
  /** True when parsed via strict hex-prefix grammar. */
  modern: boolean;
};

/** Parse Authorization bearer token — never log the secret. */
export function parseCredentialBearerToken(authorization: string | null): ParsedCredentialToken | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]!.trim();

  const modern = NEW_TOKEN_RE.exec(token);
  if (modern) {
    return {
      environment: modern[1] === "live" ? "LIVE" : "TEST",
      keyPrefix: modern[2]!,
      secret: modern[3]!,
      modern: true,
    };
  }

  // Legacy: ncc_(live|test)_<possibly-underscore-prefix>_<secret>
  // Prefix resolution is completed in resolveCredentialFromParsedToken via DB.
  const legacy = /^ncc_(live|test)_(.+)$/.exec(token);
  if (!legacy) return null;
  const envRaw = legacy[1]!;
  const rest = legacy[2]!;
  // Provisional split: first underscore-free segment of length >= 6, else mark for DB resolve.
  const firstSeg = rest.split("_")[0] ?? "";
  if (firstSeg.length < 6 || rest.length - firstSeg.length - 1 < NCC_CREDENTIAL_SECRET_MIN_LENGTH) {
    return null;
  }
  return {
    environment: envRaw === "live" ? "LIVE" : "TEST",
    keyPrefix: firstSeg,
    secret: rest.slice(firstSeg.length + 1),
    modern: false,
  };
}

/**
 * Resolve credential row for a parsed token.
 * Modern prefixes look up by unique keyPrefix.
 * Legacy underscore-containing prefixes match the longest keyPrefix that is a prefix of the token remainder.
 */
export async function resolveCredentialFromParsedToken(
  parsed: ParsedCredentialToken,
  rawAuthorization: string | null,
): Promise<NccApiCredential | null> {
  if (parsed.modern || !parsed.keyPrefix.includes("_")) {
    const byPrefix = await prisma.nccApiCredential.findUnique({
      where: { keyPrefix: parsed.keyPrefix },
    });
    if (byPrefix) return byPrefix;
  }

  // Legacy underscore prefixes: extract remainder after ncc_env_
  if (!rawAuthorization) return null;
  const bearer = rawAuthorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearer) return null;
  const restMatch = /^ncc_(?:live|test)_(.+)$/.exec(bearer);
  if (!restMatch) return null;
  const rest = restMatch[1]!;

  const candidates = await prisma.nccApiCredential.findMany({
    where: {
      environment: parsed.environment,
      keyPrefix: { contains: "_" },
    },
    take: 200,
  });
  const matches = candidates
    .filter((row) => rest.startsWith(`${row.keyPrefix}_`))
    .sort((a, b) => b.keyPrefix.length - a.keyPrefix.length);
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1 && matches[0]!.keyPrefix.length > matches[1]!.keyPrefix.length) {
    return matches[0]!;
  }
  if (matches.length > 1) return null;

  return prisma.nccApiCredential.findUnique({ where: { keyPrefix: parsed.keyPrefix } });
}

export async function createApiCredential(input: {
  institutionId: string;
  name: string;
  environment: NccApiEnvironment;
  scopes: string[];
  createdByUserId: string;
  expiresAt?: Date | null;
}): Promise<CredentialCreateResult> {
  const name = input.name.trim();
  if (!name || name.length > 120) throw new NccApiError("VALIDATION_ERROR", "Credential name is required.", 400);
  const scopes = assertScopesSupported(input.scopes);
  if (scopes.length === 0) throw new NccApiError("VALIDATION_ERROR", "At least one scope is required.", 400);

  const secret = randomToken(32);
  const secretHash = await hashApiSecret(secret);

  let row: NccApiCredential | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const keyPrefix = randomHexToken(NCC_CREDENTIAL_PREFIX_HEX_BYTES);
    try {
      row = await prisma.nccApiCredential.create({
        data: {
          institutionId: input.institutionId,
          name,
          environment: input.environment,
          keyPrefix,
          secretHash,
          scopes,
          status: "ACTIVE",
          createdByUserId: input.createdByUserId,
          expiresAt: input.expiresAt ?? null,
        },
      });
      break;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = (error.meta?.target as string[] | undefined) ?? [];
        if (target.includes("keyPrefix") || target.some((t) => String(t).includes("keyPrefix"))) {
          continue;
        }
      }
      throw error;
    }
  }
  if (!row) {
    throw new NccApiError("INTERNAL_ERROR", "Unable to allocate a unique credential prefix.", 500);
  }

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.createdByUserId,
    action: NCC_AUDIT.API_CREDENTIAL_CREATED,
    entityType: "NCC_API_CREDENTIAL",
    entityId: row.id,
    institutionId: input.institutionId,
    description: `API credential ${row.name} created (${row.environment})`,
    metadata: { keyPrefix: row.keyPrefix, environment: row.environment, scopes: row.scopes },
  });

  return {
    ...mapCredential(row),
    secret,
    authorizationHint: formatCredentialBearerToken(row.environment, row.keyPrefix, secret),
  };
}

export async function listApiCredentials(institutionId: string): Promise<CredentialPublicView[]> {
  const rows = await prisma.nccApiCredential.findMany({
    where: { institutionId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapCredential);
}

export async function revokeApiCredential(input: {
  institutionId: string;
  credentialId: string;
  actorUserId: string;
}): Promise<CredentialPublicView> {
  const existing = await prisma.nccApiCredential.findFirst({
    where: { id: input.credentialId, institutionId: input.institutionId },
  });
  if (!existing) throw new NccApiError("NOT_FOUND", "Credential not found.", 404);

  const row = await prisma.nccApiCredential.update({
    where: { id: existing.id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: NCC_AUDIT.API_CREDENTIAL_REVOKED,
    entityType: "NCC_API_CREDENTIAL",
    entityId: row.id,
    institutionId: input.institutionId,
    description: `API credential ${row.name} revoked`,
    metadata: { keyPrefix: row.keyPrefix },
  });

  return mapCredential(row);
}

/** Immediate rotation: new credential ACTIVE, previous marked ROTATED + REVOKED. */
export async function rotateApiCredential(input: {
  institutionId: string;
  credentialId: string;
  actorUserId: string;
}): Promise<CredentialCreateResult> {
  const existing = await prisma.nccApiCredential.findFirst({
    where: { id: input.credentialId, institutionId: input.institutionId },
  });
  if (!existing) throw new NccApiError("NOT_FOUND", "Credential not found.", 404);
  if (existing.status !== "ACTIVE") {
    throw new NccApiError("VALIDATION_ERROR", "Only ACTIVE credentials can be rotated.", 409);
  }

  const created = await createApiCredential({
    institutionId: input.institutionId,
    name: `${existing.name} (rotated ${new Date().toISOString().slice(0, 10)})`.slice(0, 120),
    environment: existing.environment,
    scopes: existing.scopes,
    createdByUserId: input.actorUserId,
    expiresAt: existing.expiresAt,
  });

  const rotatedName = `${existing.name} (rotated ${new Date().toISOString().slice(0, 19)})`.slice(0, 120);

  await prisma.nccApiCredential.update({
    where: { id: existing.id },
    data: {
      status: "ROTATED",
      revokedAt: new Date(),
      name: rotatedName,
      metadata: {
        ...(typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
          ? (existing.metadata as Record<string, unknown>)
          : {}),
        rotatedTo: created.id,
        originalName: existing.name,
      },
    },
  });

  await prisma.nccApiCredential.update({
    where: { id: created.id },
    data: { rotatedFromCredentialId: existing.id, name: existing.name },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: NCC_AUDIT.API_CREDENTIAL_ROTATED,
    entityType: "NCC_API_CREDENTIAL",
    entityId: created.id,
    institutionId: input.institutionId,
    description: `API credential rotated; previous prefix ${existing.keyPrefix}`,
    metadata: { previousKeyPrefix: existing.keyPrefix, newKeyPrefix: created.keyPrefix },
  });

  return { ...created, name: existing.name };
}

export async function verifyApiCredentialSecret(
  credential: NccApiCredential,
  secret: string,
): Promise<boolean> {
  const hash = await hashApiSecret(secret);
  return timingSafeEqualString(hash, credential.secretHash);
}

const LAST_USED_THROTTLE_MS = 60_000;

export async function touchCredentialLastUsed(credentialId: string): Promise<void> {
  const row = await prisma.nccApiCredential.findUnique({ where: { id: credentialId } });
  if (!row) return;
  if (row.lastUsedAt && Date.now() - row.lastUsedAt.getTime() < LAST_USED_THROTTLE_MS) return;
  await prisma.nccApiCredential.update({
    where: { id: credentialId },
    data: { lastUsedAt: new Date() },
  });
}

async function auditCredentialExpired(row: NccApiCredential): Promise<void> {
  try {
    const { writeAuditLog } = await import("@/server/audit.service");
    const actor =
      row.createdByUserId ??
      (
        await prisma.user.findFirst({
          where: { tags: { some: { tag: "CORPORATE_ADMIN" } } },
          select: { id: true },
        })
      )?.id;
    if (!actor) return;
    await writeAuditLog({
      actorUserId: actor,
      action: NCC_AUDIT.API_CREDENTIAL_EXPIRED,
      entityType: "NCC_API_CREDENTIAL",
      entityId: row.id,
      institutionId: row.institutionId,
      description: `API credential ${row.name} expired`,
      metadata: { keyPrefix: row.keyPrefix },
    });
  } catch {
    // Audit failure must not block expiry.
  }
}

export async function expireDueCredentials(limit = 100): Promise<number> {
  const due = await prisma.nccApiCredential.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: new Date() } },
    take: limit,
  });
  for (const row of due) {
    await prisma.nccApiCredential.update({
      where: { id: row.id },
      data: { status: "EXPIRED", revokedAt: row.revokedAt ?? new Date() },
    });
    await auditCredentialExpired(row);
  }
  return due.length;
}

export type { NccApiScope };
