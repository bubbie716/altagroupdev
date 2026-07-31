import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VALID_VERIFICATION_BLOCKS,
  isValidVerificationBlock,
  matchesExactVerificationBlock,
  toMinecraftBlockCoordinate,
  MINECRAFT_VERIFICATION_ZONE,
} from "@/lib/onboarding/minecraft-verification-zone";
import { generateVerificationCoordinates } from "@/lib/onboarding/minecraft-coordinate-generation";
import {
  findClaimedPlayerMatch,
  isValidMinecraftUuid,
  parseBlueMapPlayersPayload,
  sanitizeClaimedMinecraftUsername,
  DISTRICTRP_BLUEMAP_PLAYERS_URL,
} from "@/server/bluemap-players";

describe("coordinate generation", () => {
  it("precomputes only integer lattice points inside the 15-block circle", () => {
    assert.ok(VALID_VERIFICATION_BLOCKS.length > 0);
    for (const point of VALID_VERIFICATION_BLOCKS) {
      assert.equal(Number.isInteger(point.x), true);
      assert.equal(Number.isInteger(point.z), true);
      assert.equal(isValidVerificationBlock(point.x, point.z), true);
      // No Y field on coordinate objects.
      assert.equal("y" in point, false);
    }
  });

  it("includes the center and accepts exact boundary points", () => {
    const { centerX, centerZ, radius } = MINECRAFT_VERIFICATION_ZONE;
    assert.equal(isValidVerificationBlock(centerX, centerZ), true);
    assert.equal(isValidVerificationBlock(centerX + radius, centerZ), true);
    assert.equal(isValidVerificationBlock(centerX, centerZ + radius), true);
    // Just outside the circle
    assert.equal(isValidVerificationBlock(centerX + radius + 1, centerZ), false);
  });

  it("generates points from the lattice set without Y", () => {
    for (let i = 0; i < 50; i++) {
      const point = generateVerificationCoordinates();
      assert.equal(Number.isInteger(point.x), true);
      assert.equal(Number.isInteger(point.z), true);
      assert.equal(isValidVerificationBlock(point.x, point.z), true);
      assert.equal("y" in point, false);
      assert.ok(
        VALID_VERIFICATION_BLOCKS.some((p) => p.x === point.x && p.z === point.z),
      );
    }
  });
});

describe("block conversion", () => {
  it("floors confirmed live-feed decimals", () => {
    assert.equal(toMinecraftBlockCoordinate(493.4324635724842), 493);
    assert.equal(toMinecraftBlockCoordinate(209.51941635747215), 209);
  });

  it("floors negative decimals like Minecraft blocks", () => {
    assert.equal(toMinecraftBlockCoordinate(-1.1), -2);
    assert.equal(toMinecraftBlockCoordinate(-0.1), -1);
  });

  it("requires exact floor match with no tolerance", () => {
    assert.equal(matchesExactVerificationBlock(493.432, 209.519, 493, 209), true);
    assert.equal(matchesExactVerificationBlock(494.1, 209.1, 493, 209), false);
    assert.equal(matchesExactVerificationBlock(492.6, 209.1, 493, 209), false); // floors to 492
    assert.equal(matchesExactVerificationBlock(493.1, 210.1, 493, 209), false);
  });
});

describe("BlueMap feed parser", () => {
  it("accepts the confirmed schema and ignores rotation/Y", () => {
    const parsed = parseBlueMapPlayersPayload({
      players: [
        {
          uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
          name: "12700k",
          foreign: false,
          position: {
            x: 493.4324635724842,
            y: 82.0,
            z: 209.51941635747215,
          },
          rotation: {
            pitch: 89.7,
            yaw: -179.987,
            roll: 0.0,
          },
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.players.length, 1);
    assert.equal(parsed.players[0]!.name, "12700k");
    assert.equal("y" in parsed.players[0]!.position, false);
  });

  it("treats empty players as a valid offline state", () => {
    const parsed = parseBlueMapPlayersPayload({ players: [] });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.players.length, 0);
  });

  it("marks malformed top-level payloads unavailable", () => {
    assert.equal(parseBlueMapPlayersPayload(null).ok, false);
    assert.equal(parseBlueMapPlayersPayload([]).ok, false);
    assert.equal(parseBlueMapPlayersPayload({}).ok, false);
    assert.equal(parseBlueMapPlayersPayload({ players: "nope" }).ok, false);
  });

  it("ignores invalid player entries safely", () => {
    const parsed = parseBlueMapPlayersPayload({
      players: [
        { uuid: "bad", name: "x", foreign: false, position: { x: 1, z: 2 } },
        {
          uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
          name: "carter",
          foreign: false,
          position: { x: 493.1, z: 209.1 },
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.players.length, 1);
  });

  it("matches claimed username case-insensitively and rejects foreign", () => {
    const players = [
      {
        uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
        name: "Carter",
        foreign: true,
        position: { x: 493.1, z: 209.1 },
      },
    ];
    assert.equal(findClaimedPlayerMatch(players, "carter", 493, 209).status, "foreign");

    const local = [
      {
        uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
        name: "Carter",
        foreign: false,
        position: { x: 493.1, z: 209.1 },
      },
    ];
    const match = findClaimedPlayerMatch(local, "CARTER", 493, 209);
    assert.equal(match.status, "exact_match");
    if (match.status === "exact_match") {
      assert.equal(match.name, "Carter");
    }
  });

  it("does not verify another username standing on the target", () => {
    const players = [
      {
        uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        name: "SomeoneElse",
        foreign: false,
        position: { x: 493.1, z: 209.1 },
      },
    ];
    assert.equal(findClaimedPlayerMatch(players, "carter", 493, 209).status, "offline");
  });

  it("validates UUIDs and username sanitization", () => {
    assert.equal(isValidMinecraftUuid("3536c548-fbc9-4a0b-b570-ba816e78be54"), true);
    assert.equal(isValidMinecraftUuid("not-a-uuid"), false);
    assert.equal(sanitizeClaimedMinecraftUsername("  carter  "), "carter");
    assert.equal(sanitizeClaimedMinecraftUsername(""), null);
    assert.equal(sanitizeClaimedMinecraftUsername("a".repeat(33)), null);
    assert.equal(sanitizeClaimedMinecraftUsername("bad\nname"), null);
  });

  it("keeps the BlueMap URL fixed in source", () => {
    assert.equal(
      DISTRICTRP_BLUEMAP_PLAYERS_URL,
      "https://map.districtrp.xyz/maps/world/live/players.json",
    );
  });
});
