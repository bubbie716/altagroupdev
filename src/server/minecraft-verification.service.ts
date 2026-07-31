/**
 * Minecraft verification challenge lifecycle.
 * Coordinates are server-owned. Browser never supplies X/Z/world after creation.
 */
import type { MinecraftChallengeStatus, Prisma } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { prisma } from "@/server/db";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import {
  fetchBlueMapPlayers,
  findClaimedPlayerMatch,
  sanitizeClaimedMinecraftUsername,
} from "@/server/bluemap-players";
import {
  MINECRAFT_CHALLENGE_LIFETIME_MS,
  MINECRAFT_CHECK_COOLDOWN_MS,
  MINECRAFT_MAX_REGENERATIONS_PER_HOUR,
  MINECRAFT_REGENERATION_COOLDOWN_MS,
  MINECRAFT_VERIFY_RATE_LIMIT,
  MINECRAFT_VERIFY_RATE_WINDOW_MS,
  MINECRAFT_VERIFICATION_ZONE,
} from "@/lib/onboarding/minecraft-verification-zone";
import { generateVerificationCoordinates } from "@/lib/onboarding/minecraft-coordinate-generation";
import { checkRateLimit } from "@/server/rate-limit.service";
import {
  invalidateSessionUserCache,
  setSessionUserCacheForCurrentRequest,
} from "@/server/auth.service";
import { getSessionCookieName, readCookie } from "@/server/session";
import { getRequestHeader } from "@tanstack/react-start/server";
import { resolveOnboardingStep } from "@/lib/onboarding/onboarding-steps";

export type ChallengePublicView = {
  id: string;
  claimedUsername: string;
  targetWorld: string;
  targetX: number;
  targetZ: number;
  status: MinecraftChallengeStatus;
  expiresAt: string;
  attemptCount: number;
  regenerationCount: number;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  secondsRemaining: number;
  canRegenerate: boolean;
  regenerateCooldownSeconds: number;
};

export type LocationCheckResult =
  | {
      outcome: "verified";
      user: AltaUser;
      challenge: ChallengePublicView;
      verifiedUsername: string;
    }
  | {
      outcome:
        | "offline"
        | "wrong_block"
        | "foreign"
        | "feed_unavailable"
        | "feed_delayed"
        | "expired"
        | "rate_limited"
        | "cooldown"
        | "username_linked"
        | "no_challenge";
      message: string;
      challenge: ChallengePublicView | null;
      retryAfterSeconds?: number;
    };

function toPublicView(
  row: {
    id: string;
    claimedUsername: string;
    targetWorld: string;
    targetX: number;
    targetZ: number;
    status: MinecraftChallengeStatus;
    expiresAt: Date;
    attemptCount: number;
    regenerationCount: number;
    lastCheckedAt: Date | null;
    verifiedAt: Date | null;
    createdAt: Date;
  },
  now = Date.now(),
): ChallengePublicView {
  const secondsRemaining = Math.max(0, Math.floor((row.expiresAt.getTime() - now) / 1000));
  // Regeneration cooldown is measured from this pending challenge's creation time.
  const sinceCreated = now - row.createdAt.getTime();
  const regenerateCooldownMs = Math.max(0, MINECRAFT_REGENERATION_COOLDOWN_MS - sinceCreated);

  return {
    id: row.id,
    claimedUsername: row.claimedUsername,
    targetWorld: row.targetWorld,
    targetX: row.targetX,
    targetZ: row.targetZ,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    attemptCount: row.attemptCount,
    regenerationCount: row.regenerationCount,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    secondsRemaining,
    canRegenerate: regenerateCooldownMs <= 0,
    regenerateCooldownSeconds: Math.ceil(regenerateCooldownMs / 1000),
  };
}

async function getActivePendingChallenge(userId: string) {
  const challenge = await prisma.minecraftVerificationChallenge.findFirst({
    where: { userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return null;

  if (challenge.expiresAt.getTime() <= Date.now()) {
    const expired = await prisma.minecraftVerificationChallenge.update({
      where: { id: challenge.id },
      data: { status: "EXPIRED" },
    });
    void writeMinecraftAudit(userId, "MINECRAFT_CHALLENGE_EXPIRED", "Minecraft challenge expired", {
      challengeId: expired.id,
    });
    return null;
  }

  return challenge;
}

export async function getActiveChallengeForUser(userId: string): Promise<ChallengePublicView | null> {
  const challenge = await getActivePendingChallenge(userId);
  return challenge ? toPublicView(challenge) : null;
}

async function countRegenerationsLastHour(userId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  return prisma.minecraftVerificationChallenge.count({
    where: {
      userId,
      createdAt: { gte: since },
    },
  });
}

export async function createMinecraftChallenge(
  actor: AltaUser,
  claimedUsernameRaw: string,
): Promise<ChallengePublicView> {
  const claimedUsername = sanitizeClaimedMinecraftUsername(claimedUsernameRaw);
  if (!claimedUsername) {
    throw new Error("MINECRAFT_USERNAME_INVALID");
  }

  if (actor.minecraftVerifiedAt) {
    throw new Error("MINECRAFT_ALREADY_VERIFIED");
  }

  const regenerations = await countRegenerationsLastHour(actor.id);
  if (regenerations >= MINECRAFT_MAX_REGENERATIONS_PER_HOUR) {
    throw new Error("MINECRAFT_REGEN_LIMIT");
  }

  const existing = await prisma.minecraftVerificationChallenge.findFirst({
    where: { userId: actor.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const sinceCreated = Date.now() - existing.createdAt.getTime();
    if (sinceCreated < MINECRAFT_REGENERATION_COOLDOWN_MS) {
      throw new Error("MINECRAFT_REGEN_COOLDOWN");
    }
  }

  const coords = generateVerificationCoordinates();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MINECRAFT_CHALLENGE_LIFETIME_MS);

  const challenge = await prisma.$transaction(async (tx) => {
    await tx.minecraftVerificationChallenge.updateMany({
      where: { userId: actor.id, status: "PENDING" },
      data: { status: "REPLACED", replacedAt: now },
    });

    return tx.minecraftVerificationChallenge.create({
      data: {
        userId: actor.id,
        claimedUsername,
        targetWorld: MINECRAFT_VERIFICATION_ZONE.world,
        targetX: coords.x,
        targetZ: coords.z,
        status: "PENDING",
        expiresAt,
        regenerationCount: regenerations + (existing ? 1 : 0),
      },
    });
  });

  void writeMinecraftAudit(
    actor.id,
    existing ? "MINECRAFT_CHALLENGE_REGENERATED" : "MINECRAFT_CHALLENGE_CREATED",
    existing ? "Minecraft challenge regenerated" : "Minecraft challenge created",
    {
      challengeId: challenge.id,
      targetX: challenge.targetX,
      targetZ: challenge.targetZ,
    },
  );

  return toPublicView(challenge);
}

export async function checkMinecraftLocation(actor: AltaUser): Promise<LocationCheckResult> {
  if (actor.minecraftVerifiedAt && actor.onboardingCompletedAt) {
    const challenge = await prisma.minecraftVerificationChallenge.findFirst({
      where: { userId: actor.id, status: "VERIFIED" },
      orderBy: { verifiedAt: "desc" },
    });
    return {
      outcome: "verified",
      user: actor,
      challenge: challenge ? toPublicView(challenge) : {
        id: "already-verified",
        claimedUsername: actor.minecraftUsername ?? "",
        targetWorld: MINECRAFT_VERIFICATION_ZONE.world,
        targetX: 0,
        targetZ: 0,
        status: "VERIFIED",
        expiresAt: new Date().toISOString(),
        attemptCount: 0,
        regenerationCount: 0,
        lastCheckedAt: null,
        verifiedAt: actor.minecraftVerifiedAt,
        secondsRemaining: 0,
        canRegenerate: false,
        regenerateCooldownSeconds: 0,
      },
      verifiedUsername: actor.minecraftUsername ?? "",
    };
  }

  const rate = checkRateLimit({
    key: `minecraft-verify:user:${actor.id}`,
    limit: MINECRAFT_VERIFY_RATE_LIMIT,
    windowMs: MINECRAFT_VERIFY_RATE_WINDOW_MS,
  });
  if (!rate.allowed) {
    return {
      outcome: "rate_limited",
      message: "Too many verification checks. Please wait a moment and try again.",
      challenge: null,
      retryAfterSeconds: Math.ceil(rate.retryAfterMs / 1000),
    };
  }

  const challenge = await getActivePendingChallenge(actor.id);
  if (!challenge) {
    return {
      outcome: "no_challenge",
      message: "These coordinates expired. Generate a new verification location.",
      challenge: null,
    };
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    await prisma.minecraftVerificationChallenge.update({
      where: { id: challenge.id },
      data: { status: "EXPIRED" },
    });
    return {
      outcome: "expired",
      message: "These coordinates expired. Generate a new verification location.",
      challenge: toPublicView({ ...challenge, status: "EXPIRED" }),
    };
  }

  if (challenge.lastCheckedAt) {
    const since = Date.now() - challenge.lastCheckedAt.getTime();
    if (since < MINECRAFT_CHECK_COOLDOWN_MS) {
      return {
        outcome: "cooldown",
        message: "Stay on the block — checking again shortly.",
        challenge: toPublicView(challenge),
        retryAfterSeconds: Math.ceil((MINECRAFT_CHECK_COOLDOWN_MS - since) / 1000),
      };
    }
  }

  await prisma.minecraftVerificationChallenge.update({
    where: { id: challenge.id },
    data: {
      lastCheckedAt: new Date(),
      attemptCount: { increment: 1 },
    },
  });

  void writeMinecraftAudit(
    actor.id,
    "MINECRAFT_LOCATION_CHECK_ATTEMPTED",
    "Minecraft location check attempted",
    { challengeId: challenge.id },
  );

  const feed = await fetchBlueMapPlayers();
  if (!feed.ok) {
    const refreshed = await prisma.minecraftVerificationChallenge.findUniqueOrThrow({
      where: { id: challenge.id },
    });
    return {
      outcome: feed.reason === "timeout" ? "feed_delayed" : "feed_unavailable",
      message:
        feed.reason === "timeout"
          ? "The live map may still be updating. Stay on the block and try again in a moment."
          : "DistrictRP’s live map is temporarily unavailable. Your verification coordinates are saved.",
      challenge: toPublicView(refreshed),
    };
  }

  const match = findClaimedPlayerMatch(
    feed.players,
    challenge.claimedUsername,
    challenge.targetX,
    challenge.targetZ,
  );

  const refreshed = await prisma.minecraftVerificationChallenge.findUniqueOrThrow({
    where: { id: challenge.id },
  });

  if (match.status === "offline") {
    return {
      outcome: "offline",
      message: `We couldn’t find ${challenge.claimedUsername} online. Join DistrictRP, then try again.`,
      challenge: toPublicView(refreshed),
    };
  }
  if (match.status === "foreign") {
    return {
      outcome: "foreign",
      message: "Join the main DistrictRP world before verifying.",
      challenge: toPublicView(refreshed),
    };
  }
  if (match.status === "wrong_block") {
    return {
      outcome: "wrong_block",
      message: `We found you online, but you aren’t on the verification block yet. Move to X ${challenge.targetX}, Z ${challenge.targetZ} and stay there while we check again.`,
      challenge: toPublicView(refreshed),
    };
  }

  // Exact match — check UUID uniqueness.
  const linked = await prisma.user.findFirst({
    where: {
      minecraftUuid: match.uuid,
      NOT: { id: actor.id },
    },
    select: { id: true },
  });
  if (linked) {
    return {
      outcome: "username_linked",
      message: "That Minecraft account is already connected to another Alta account.",
      challenge: toPublicView(refreshed),
    };
  }

  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      // Re-check challenge status inside transaction for concurrency.
      const current = await tx.minecraftVerificationChallenge.findUnique({
        where: { id: challenge.id },
      });
      if (!current || current.status !== "PENDING") {
        throw new Error("MINECRAFT_CHALLENGE_NOT_PENDING");
      }

      const userRow = await tx.user.findUnique({ where: { id: actor.id } });
      if (!userRow) throw new Error("USER_NOT_FOUND");
      if (userRow.minecraftVerifiedAt) return;

      const conflict = await tx.user.findFirst({
        where: { minecraftUuid: match.uuid, NOT: { id: actor.id } },
        select: { id: true },
      });
      if (conflict) throw new Error("MINECRAFT_UUID_LINKED");

      await tx.minecraftVerificationChallenge.update({
        where: { id: challenge.id },
        data: { status: "VERIFIED", verifiedAt: now },
      });

      await tx.user.update({
        where: { id: actor.id },
        data: {
          minecraftUsername: match.name,
          minecraftUuid: match.uuid,
          minecraftVerifiedAt: now,
          onboardingCompletedAt: now,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MINECRAFT_UUID_LINKED") {
      return {
        outcome: "username_linked",
        message: "That Minecraft account is already connected to another Alta account.",
        challenge: toPublicView(refreshed),
      };
    }
    if (error instanceof Error && error.message === "MINECRAFT_CHALLENGE_NOT_PENDING") {
      const user = await reloadUser(actor.id);
      if (user.minecraftVerifiedAt) {
        return {
          outcome: "verified",
          user,
          challenge: toPublicView({ ...refreshed, status: "VERIFIED", verifiedAt: now }),
          verifiedUsername: user.minecraftUsername ?? match.name,
        };
      }
      throw error;
    }
    // Unique constraint race on minecraftUuid
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return {
        outcome: "username_linked",
        message: "That Minecraft account is already connected to another Alta account.",
        challenge: toPublicView(refreshed),
      };
    }
    throw error;
  }

  const user = await reloadUser(actor.id);
  invalidateCachesAfterChange(user);

  void writeMinecraftAudit(
    actor.id,
    "MINECRAFT_VERIFICATION_COMPLETED",
    "Minecraft verification completed",
    { challengeId: challenge.id, minecraftUuid: match.uuid },
  ).catch((err) => console.error("[minecraft] audit write failed", err));

  return {
    outcome: "verified",
    user,
    challenge: toPublicView({
      ...refreshed,
      status: "VERIFIED",
      verifiedAt: now,
    }),
    verifiedUsername: match.name,
  };
}

/** Staff: replace/expire pending challenge without verifying. */
export async function operatorResetMinecraftChallenge(
  actor: AltaUser,
  targetUserId: string,
  reason: string,
): Promise<void> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new Error("REASON_REQUIRED");

  await prisma.minecraftVerificationChallenge.updateMany({
    where: { userId: targetUserId, status: "PENDING" },
    data: { status: "REPLACED", replacedAt: new Date() },
  });

  void writeMinecraftAudit(
    actor.id,
    "MINECRAFT_VERIFICATION_RESET",
    "Minecraft verification challenge reset by staff",
    { targetUserId, reason: trimmed },
    targetUserId,
  );
}

/**
 * Staff: require reverification.
 * Retains UUID reservation to prevent hijack; clears verified status + onboardingCompletedAt.
 */
export async function operatorRequireMinecraftReverification(
  actor: AltaUser,
  targetUserId: string,
  reason: string,
): Promise<void> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new Error("REASON_REQUIRED");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.minecraftVerificationChallenge.updateMany({
      where: { userId: targetUserId, status: "PENDING" },
      data: { status: "REPLACED", replacedAt: now },
    });

    await tx.user.update({
      where: { id: targetUserId },
      data: {
        minecraftVerifiedAt: null,
        onboardingCompletedAt: null,
        // Retain minecraftUuid reservation — clears only verification status.
      },
    });
  });

  void writeMinecraftAudit(
    actor.id,
    "MINECRAFT_REVERIFICATION_REQUIRED",
    "Minecraft reverification required by staff",
    { targetUserId, reason: trimmed },
    targetUserId,
  );
}

async function reloadUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  return mapDbUserToAltaUser(user);
}

function invalidateCachesAfterChange(user: AltaUser): void {
  try {
    const cookieHeader = getRequestHeader("cookie");
    const token = readCookie(getSessionCookieName(), cookieHeader);
    invalidateSessionUserCache(token ?? undefined);
  } catch {
    invalidateSessionUserCache();
  }
  setSessionUserCacheForCurrentRequest(user);
}

async function writeMinecraftAudit(
  actorUserId: string,
  action: string,
  description: string,
  metadata: Record<string, unknown>,
  targetUserId?: string,
): Promise<void> {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    targetUserId: targetUserId ?? actorUserId,
    entityId: targetUserId ?? actorUserId,
    action,
    entityType: "ONBOARDING",
    description,
    metadata: { source: "SYSTEM", severity: "info", ...metadata },
  });
}

export { resolveOnboardingStep };
export type { Prisma };
