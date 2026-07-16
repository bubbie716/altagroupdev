import type { FinancialInstitution, NccApiCredential, NccApiEnvironment } from "@prisma/client";
import { prisma } from "@/server/db";
import { NccApiError } from "@/lib/ncc/ncc-api-errors";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import type { NccApiScope } from "@/lib/ncc/ncc-api-scopes";
import {
  parseCredentialBearerToken,
  resolveCredentialFromParsedToken,
  touchCredentialLastUsed,
  verifyApiCredentialSecret,
} from "@/server/ncc/ncc-api-credential.service";

export type AuthenticatedNccApiContext = {
  credentialId: string;
  institutionId: string;
  environment: NccApiEnvironment;
  scopes: NccApiScope[];
  institution: FinancialInstitution;
  credential: NccApiCredential;
  requestId: string;
};

function institutionEligible(institution: FinancialInstitution): void {
  if (institution.status !== "ACTIVE") {
    throw new NccApiError("INSTITUTION_INACTIVE", "The institution is not eligible for API operations.", 403);
  }
  if (!institution.isNCCParticipant) {
    throw new NccApiError(
      "INSTITUTION_NOT_PARTICIPANT",
      "The institution is not an NCC participant.",
      403,
    );
  }
}

async function recordAuthRejection(input: {
  actorUserId?: string;
  institutionId?: string;
  reason: string;
}): Promise<void> {
  try {
    const { writeAuditLog } = await import("@/server/audit.service");
    const actor =
      input.actorUserId ??
      (
        await prisma.user.findFirst({
          where: { tags: { some: { tag: "ADMIN" } } },
          select: { id: true },
        })
      )?.id;
    if (!actor) return;
    await writeAuditLog({
      actorUserId: actor,
      action: NCC_AUDIT.API_AUTHENTICATION_REJECTED,
      entityType: "NCC_API_CREDENTIAL",
      entityId: undefined,
      institutionId: input.institutionId,
      description: "API authentication rejected",
      metadata: { reason: input.reason },
    });
  } catch {
    // Never fail the request path on audit write.
  }
}

/**
 * Authenticate an institution API request from the Authorization header.
 * Returns a sanitized UNAUTHORIZED for all credential failures (no oracle).
 */
export async function authenticateNccApiRequest(
  request: Request,
  requestId: string,
): Promise<AuthenticatedNccApiContext> {
  const authorization = request.headers.get("authorization");
  const parsed = parseCredentialBearerToken(authorization);
  if (!parsed) {
    await recordAuthRejection({ reason: "malformed_or_missing" });
    throw new NccApiError("UNAUTHORIZED", "Authentication failed.", 401);
  }

  const credential = await resolveCredentialFromParsedToken(parsed, authorization);
  if (!credential) {
    await recordAuthRejection({ reason: "unknown_prefix" });
    throw new NccApiError("UNAUTHORIZED", "Authentication failed.", 401);
  }

  // For legacy underscore prefixes, recompute secret from the remainder after the true keyPrefix.
  let secret = parsed.secret;
  if (!parsed.modern && credential.keyPrefix.includes("_")) {
    const bearer = authorization!.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
    const rest = bearer.replace(/^ncc_(?:live|test)_/, "");
    if (!rest.startsWith(`${credential.keyPrefix}_`)) {
      await recordAuthRejection({ institutionId: credential.institutionId, reason: "secret_mismatch" });
      throw new NccApiError("UNAUTHORIZED", "Authentication failed.", 401);
    }
    secret = rest.slice(credential.keyPrefix.length + 1);
  }

  const secretOk = await verifyApiCredentialSecret(credential, secret);
  if (!secretOk) {
    await recordAuthRejection({ institutionId: credential.institutionId, reason: "secret_mismatch" });
    throw new NccApiError("UNAUTHORIZED", "Authentication failed.", 401);
  }

  if (credential.environment !== parsed.environment) {
    await recordAuthRejection({ institutionId: credential.institutionId, reason: "environment_token_mismatch" });
    throw new NccApiError("UNAUTHORIZED", "Authentication failed.", 401);
  }

  if (credential.status === "REVOKED" || credential.status === "ROTATED") {
    await recordAuthRejection({ institutionId: credential.institutionId, reason: "revoked" });
    throw new NccApiError("UNAUTHORIZED", "Authentication failed.", 401);
  }
  if (credential.status === "EXPIRED" || (credential.expiresAt && credential.expiresAt.getTime() <= Date.now())) {
    if (credential.status === "ACTIVE") {
      await prisma.nccApiCredential.update({
        where: { id: credential.id },
        data: { status: "EXPIRED", revokedAt: credential.revokedAt ?? new Date() },
      });
      try {
        const { writeAuditLog } = await import("@/server/audit.service");
        const actor =
          credential.createdByUserId ??
          (
            await prisma.user.findFirst({
              where: { tags: { some: { tag: "ADMIN" } } },
              select: { id: true },
            })
          )?.id;
        if (actor) {
          await writeAuditLog({
            actorUserId: actor,
            action: NCC_AUDIT.API_CREDENTIAL_EXPIRED,
            entityType: "NCC_API_CREDENTIAL",
            entityId: credential.id,
            institutionId: credential.institutionId,
            description: `API credential ${credential.name} expired`,
            metadata: { keyPrefix: credential.keyPrefix },
          });
        }
      } catch {
        // ignore audit failures
      }
    }
    await recordAuthRejection({ institutionId: credential.institutionId, reason: "expired" });
    throw new NccApiError("UNAUTHORIZED", "Authentication failed.", 401);
  }
  if (credential.status !== "ACTIVE") {
    await recordAuthRejection({ institutionId: credential.institutionId, reason: "inactive" });
    throw new NccApiError("UNAUTHORIZED", "Authentication failed.", 401);
  }

  const institution = await prisma.financialInstitution.findUniqueOrThrow({
    where: { id: credential.institutionId },
  });
  try {
    institutionEligible(institution);
  } catch (error) {
    await recordAuthRejection({ institutionId: institution.id, reason: "institution_ineligible" });
    throw error;
  }

  void touchCredentialLastUsed(credential.id);

  return {
    credentialId: credential.id,
    institutionId: institution.id,
    environment: credential.environment,
    scopes: credential.scopes as NccApiScope[],
    institution,
    credential,
    requestId,
  };
}

export function requireApiScope(ctx: AuthenticatedNccApiContext, scope: NccApiScope): void {
  if (!ctx.scopes.includes(scope)) {
    void import("@/server/audit.service").then(async ({ writeAuditLog }) => {
      const actor =
        ctx.credential.createdByUserId ??
        (
          await prisma.user.findFirst({
            where: { tags: { some: { tag: "ADMIN" } } },
            select: { id: true },
          })
        )?.id;
      if (!actor) return;
      await writeAuditLog({
        actorUserId: actor,
        action: NCC_AUDIT.API_SCOPE_REJECTED,
        entityType: "NCC_API_CREDENTIAL",
        entityId: ctx.credentialId,
        institutionId: ctx.institutionId,
        description: `API scope rejected: ${scope}`,
        metadata: { requiredScope: scope },
      });
    });
    throw new NccApiError("INSUFFICIENT_SCOPE", "The credential lacks the required scope.", 403);
  }
}

/** LIVE credentials only for financial mutations — no fake TEST settlement environment. */
export function requireLiveForFinancialMutation(ctx: AuthenticatedNccApiContext): void {
  if (ctx.environment !== "LIVE") {
    throw new NccApiError(
      "ENVIRONMENT_MISMATCH",
      "TEST credentials cannot create live settlements. Use a LIVE credential.",
      403,
    );
  }
}
