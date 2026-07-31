/**
 * Server-only coordinate generation using crypto.randomInt.
 * Do not import this module from client components.
 */
import { randomInt } from "node:crypto";
import {
  VALID_VERIFICATION_BLOCKS,
  type BlockCoordinate,
} from "@/lib/onboarding/minecraft-verification-zone";

/**
 * Uniformly select a target block from the complete lattice-point set.
 * Uses crypto.randomInt — never Math.random.
 */
export function generateVerificationCoordinates(): BlockCoordinate {
  const index = randomInt(0, VALID_VERIFICATION_BLOCKS.length);
  const point = VALID_VERIFICATION_BLOCKS[index]!;
  return { x: point.x, z: point.z };
}
