import { randomToken } from "@/server/crypto";
import { prisma } from "@/server/db";

const HANDOFF_TTL_MS = 60_000;

export function stripWwwHost(host: string): string {
  const normalized = host.toLowerCase();
  return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
}

export function hostsMatch(a: string, b: string): boolean {
  return stripWwwHost(a) === stripWwwHost(b);
}

/** Create opaque single-use handoff token — session token stored server-side only. */
export async function createSessionHandoff(sessionToken: string): Promise<string | null> {
  const handoffToken = randomToken(24);
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS);

  try {
    await prisma.sessionHandoff.create({
      data: {
        handoffToken,
        sessionToken,
        expiresAt,
      },
    });
    return handoffToken;
  } catch {
    return null;
  }
}

export type RedeemedSessionHandoff = {
  sessionToken: string;
};

/**
 * Redeem handoff exactly once. Returns null if missing, expired, or already used.
 */
export async function redeemSessionHandoff(
  handoffToken: string,
): Promise<RedeemedSessionHandoff | null> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; sessionToken: string; expiresAt: Date }>>`
      SELECT id, "sessionToken", "expiresAt"
      FROM "SessionHandoff"
      WHERE "handoffToken" = ${handoffToken}
        AND "redeemedAt" IS NULL
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt.getTime() < now.getTime()) return null;

    await tx.sessionHandoff.update({
      where: { id: row.id },
      data: { redeemedAt: now },
    });

    return { sessionToken: row.sessionToken };
  });
}

/** @deprecated Sealed URL tokens removed — use createSessionHandoff/redeemSessionHandoff. */
export async function createSessionHandoffToken(_sessionToken: string): Promise<string | null> {
  return createSessionHandoff(_sessionToken);
}

/** @deprecated */
export async function readSessionHandoffToken(_token: string) {
  return null;
}
