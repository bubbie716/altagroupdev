/**
 * Minecraft verification zone constants and exact-block helpers.
 * Safe for shared/client imports — no Node crypto.
 */
export const MINECRAFT_VERIFICATION_ZONE = {
  world: "world",
  centerX: 493,
  centerZ: 209,
  radius: 15,
} as const;

export type BlockCoordinate = {
  x: number;
  z: number;
};

/** Precompute every integer lattice point inside the verification circle. */
function buildValidLatticePoints(): ReadonlyArray<BlockCoordinate> {
  const { centerX, centerZ, radius } = MINECRAFT_VERIFICATION_ZONE;
  const r2 = radius * radius;
  const points: BlockCoordinate[] = [];
  for (let x = centerX - radius; x <= centerX + radius; x++) {
    for (let z = centerZ - radius; z <= centerZ + radius; z++) {
      const dx = x - centerX;
      const dz = z - centerZ;
      if (dx * dx + dz * dz <= r2) {
        points.push({ x, z });
      }
    }
  }
  return points;
}

export const VALID_VERIFICATION_BLOCKS: ReadonlyArray<BlockCoordinate> =
  buildValidLatticePoints();

export function isValidVerificationBlock(x: number, z: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(z)) return false;
  const { centerX, centerZ, radius } = MINECRAFT_VERIFICATION_ZONE;
  const dx = x - centerX;
  const dz = z - centerZ;
  return dx * dx + dz * dz <= radius * radius;
}

/**
 * Convert live-feed decimal positions to Minecraft block coordinates.
 * Must use Math.floor (not round / truncate-toward-zero).
 */
export function toMinecraftBlockCoordinate(value: number): number {
  return Math.floor(value);
}

export function matchesExactVerificationBlock(
  playerX: number,
  playerZ: number,
  targetX: number,
  targetZ: number,
): boolean {
  return (
    toMinecraftBlockCoordinate(playerX) === targetX &&
    toMinecraftBlockCoordinate(playerZ) === targetZ
  );
}

export const MINECRAFT_CHALLENGE_LIFETIME_MS = 15 * 60 * 1000;
export const MINECRAFT_CHECK_COOLDOWN_MS = 2_000;
export const MINECRAFT_REGENERATION_COOLDOWN_MS = 30_000;
export const MINECRAFT_MAX_REGENERATIONS_PER_HOUR = 5;
export const MINECRAFT_VERIFY_RATE_LIMIT = 30;
export const MINECRAFT_VERIFY_RATE_WINDOW_MS = 60_000;
export const MINECRAFT_USERNAME_MAX_LENGTH = 32;
export const MINECRAFT_FEED_TIMEOUT_MS = 4_000;
