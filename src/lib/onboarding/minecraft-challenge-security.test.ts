/**
 * Challenge security invariants that do not require a live database.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MINECRAFT_VERIFICATION_ZONE,
  matchesExactVerificationBlock,
} from "@/lib/onboarding/minecraft-verification-zone";
import { generateVerificationCoordinates } from "@/lib/onboarding/minecraft-coordinate-generation";
import {
  findClaimedPlayerMatch,
  parseBlueMapPlayersPayload,
  sanitizeClaimedMinecraftUsername,
} from "@/server/bluemap-players";
import { assertNotUiLabMutation } from "@/lib/internal/ui-lab-mutation-gate";

describe("challenge security invariants", () => {
  it("never accepts client-supplied coordinates — generation is server-owned", () => {
    const a = generateVerificationCoordinates();
    const b = generateVerificationCoordinates();
    // Both must be inside the hardcoded zone; callers never pass X/Z/world.
    assert.equal(MINECRAFT_VERIFICATION_ZONE.world, "world");
    assert.equal(MINECRAFT_VERIFICATION_ZONE.centerX, 493);
    assert.equal(MINECRAFT_VERIFICATION_ZONE.centerZ, 209);
    assert.equal(MINECRAFT_VERIFICATION_ZONE.radius, 15);
    for (const point of [a, b]) {
      const dx = point.x - 493;
      const dz = point.z - 209;
      assert.ok(dx * dx + dz * dz <= 15 * 15);
    }
  });

  it("claimed username sanitization rejects empty/control input", () => {
    assert.equal(sanitizeClaimedMinecraftUsername("\u0000carter"), null);
    assert.equal(sanitizeClaimedMinecraftUsername("   "), null);
  });

  it("another player on the target block cannot verify the claimed username", () => {
    const feed = parseBlueMapPlayersPayload({
      players: [
        {
          uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          name: "Intruder",
          foreign: false,
          position: { x: 493.2, y: 80, z: 209.2 },
        },
      ],
    });
    assert.equal(feed.ok, true);
    if (!feed.ok) return;
    assert.equal(findClaimedPlayerMatch(feed.players, "carter", 493, 209).status, "offline");
  });

  it("exact-block equality rejects adjacent and round-only positions", () => {
    assert.equal(matchesExactVerificationBlock(493.9, 209.9, 493, 209), true);
    assert.equal(matchesExactVerificationBlock(494.0, 209.0, 493, 209), false);
    assert.equal(matchesExactVerificationBlock(492.6, 209.0, 493, 209), false);
  });

  it("parser never returns Y or rotation to callers", () => {
    const feed = parseBlueMapPlayersPayload({
      players: [
        {
          uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
          name: "carter",
          foreign: false,
          position: { x: 1, y: 99, z: 2 },
          rotation: { pitch: 1, yaw: 2, roll: 3 },
        },
      ],
    });
    assert.equal(feed.ok, true);
    if (!feed.ok) return;
    assert.deepEqual(Object.keys(feed.players[0]!.position).sort(), ["x", "z"]);
    assert.equal("rotation" in feed.players[0]!, false);
  });

  it("UI Lab mutation gate helper remains available for challenge writes", () => {
    assert.doesNotThrow(() => assertNotUiLabMutation("Minecraft challenge creation"));
  });
});
