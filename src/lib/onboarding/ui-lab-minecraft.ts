/**
 * UI Lab Minecraft verification fixtures — never writes production challenges.
 * Deterministic feed outcomes using the confirmed BlueMap schema.
 */
import { isUiLabMode } from "@/lib/auth/ui-lab";
import {
  findClaimedPlayerMatch,
  parseBlueMapPlayersPayload,
  sanitizeClaimedMinecraftUsername,
} from "@/server/bluemap-players";
import type { ChallengePublicView, LocationCheckResult } from "@/server/minecraft-verification.service";
import { MINECRAFT_VERIFICATION_ZONE } from "@/lib/onboarding/minecraft-verification-zone";
import { getUiLabOnboardingScenario } from "@/lib/onboarding/ui-lab-onboarding";

const CHALLENGE_KEY = "alta.onboarding.uiLabMinecraftChallenge";

export type UiLabMinecraftCheckScenario =
  | "player_offline"
  | "exact_block_success"
  | "adjacent_block_fail"
  | "round_vs_floor_fail"
  | "wrong_z"
  | "wrong_x"
  | "foreign_true"
  | "wrong_username_at_target"
  | "online_elsewhere"
  | "duplicate_uuid"
  | "expired_challenge"
  | "regen_cooldown"
  | "feed_timeout"
  | "malformed_json"
  | "malformed_player_entry"
  | "server_error"
  | "concurrent_confirmation"
  | "existing_unverified_prefills"
  | "fully_verified";

const CHECK_SCENARIO_ALIASES: Record<string, UiLabMinecraftCheckScenario> = {
  minecraft_offline: "player_offline",
  minecraft_exact_success: "exact_block_success",
  minecraft_adjacent_fail: "adjacent_block_fail",
  minecraft_round_fail: "round_vs_floor_fail",
  minecraft_wrong_z: "wrong_z",
  minecraft_wrong_x: "wrong_x",
  minecraft_foreign: "foreign_true",
  minecraft_wrong_username: "wrong_username_at_target",
  minecraft_elsewhere: "online_elsewhere",
  minecraft_duplicate_uuid: "duplicate_uuid",
  minecraft_expired: "expired_challenge",
  minecraft_regen_cooldown: "regen_cooldown",
  minecraft_feed_timeout: "feed_timeout",
  minecraft_malformed_json: "malformed_json",
  minecraft_malformed_player: "malformed_player_entry",
  minecraft_server_error: "server_error",
  minecraft_concurrent: "concurrent_confirmation",
  minecraft_unverified: "existing_unverified_prefills",
  existing_unverified_prefills: "existing_unverified_prefills",
  fully_verified: "fully_verified",
};

function resolveCheckScenario(raw?: string): UiLabMinecraftCheckScenario {
  const fromArg = raw ? CHECK_SCENARIO_ALIASES[raw] ?? (raw as UiLabMinecraftCheckScenario) : null;
  if (fromArg && isKnownCheck(fromArg)) return fromArg;
  const scenario = getUiLabOnboardingScenario();
  return CHECK_SCENARIO_ALIASES[scenario] ?? "exact_block_success";
}

function isKnownCheck(value: string): value is UiLabMinecraftCheckScenario {
  return Object.values(CHECK_SCENARIO_ALIASES).includes(value as UiLabMinecraftCheckScenario);
}

function defaultChallenge(overrides: Partial<ChallengePublicView> = {}): ChallengePublicView {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  return {
    id: "ui-lab-challenge",
    claimedUsername: "carter",
    targetWorld: MINECRAFT_VERIFICATION_ZONE.world,
    targetX: 493,
    targetZ: 209,
    status: "PENDING",
    expiresAt,
    attemptCount: 0,
    regenerationCount: 0,
    lastCheckedAt: null,
    verifiedAt: null,
    secondsRemaining: 15 * 60,
    canRegenerate: true,
    regenerateCooldownSeconds: 0,
    ...overrides,
  };
}

function readStoredChallenge(): ChallengePublicView | null {
  if (!isUiLabMode() || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CHALLENGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ChallengePublicView;
  } catch {
    return null;
  }
}

function writeStoredChallenge(challenge: ChallengePublicView | null): void {
  if (!isUiLabMode() || typeof window === "undefined") return;
  try {
    if (!challenge) window.sessionStorage.removeItem(CHALLENGE_KEY);
    else window.sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge));
  } catch {
    /* ignore */
  }
}

export function getUiLabStoredMinecraftChallenge(): ChallengePublicView | null {
  return readStoredChallenge();
}

export function mockUiLabCreateMinecraftChallenge(
  claimedUsernameRaw: string,
  scenarioRaw?: string,
): ChallengePublicView {
  const scenario = resolveCheckScenario(scenarioRaw);
  if (scenario === "regen_cooldown") {
    throw new Error("MINECRAFT_REGEN_COOLDOWN");
  }
  if (scenario === "fully_verified") {
    throw new Error("MINECRAFT_ALREADY_VERIFIED");
  }

  const claimedUsername = sanitizeClaimedMinecraftUsername(claimedUsernameRaw);
  if (!claimedUsername) throw new Error("MINECRAFT_USERNAME_INVALID");

  const existing = readStoredChallenge();
  // Changing username replaces challenge (UI Lab simulation).
  const challenge = defaultChallenge({
    id: `ui-lab-${Date.now()}`,
    claimedUsername,
    regenerationCount: existing ? existing.regenerationCount + 1 : 0,
  });
  writeStoredChallenge(challenge);
  return challenge;
}

/** Confirmed-schema fixtures for parser smoke + location checks. */
export function uiLabFeedFixture(scenario: UiLabMinecraftCheckScenario, challenge: ChallengePublicView) {
  const { targetX, targetZ, claimedUsername } = challenge;
  switch (scenario) {
    case "player_offline":
      return { players: [] };
    case "exact_block_success":
      return {
        players: [
          {
            uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
            name: claimedUsername,
            foreign: false,
            position: { x: targetX + 0.4324635724842, y: 82.0, z: targetZ + 0.51941635747215 },
            rotation: { pitch: 89.7, yaw: -179.98, roll: 0.0 },
          },
        ],
      };
    case "adjacent_block_fail":
      return {
        players: [
          {
            uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
            name: claimedUsername,
            foreign: false,
            position: { x: targetX + 1.1, y: 82.0, z: targetZ + 0.2 },
          },
        ],
      };
    case "round_vs_floor_fail":
      // 492.6 rounds to 493 but floors to 492 — must fail.
      return {
        players: [
          {
            uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
            name: claimedUsername,
            foreign: false,
            position: { x: targetX - 0.4, y: 82.0, z: targetZ + 0.2 },
          },
        ],
      };
    case "wrong_z":
      return {
        players: [
          {
            uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
            name: claimedUsername,
            foreign: false,
            position: { x: targetX + 0.1, y: 82.0, z: targetZ + 3.2 },
          },
        ],
      };
    case "wrong_x":
      return {
        players: [
          {
            uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
            name: claimedUsername,
            foreign: false,
            position: { x: targetX + 3.2, y: 82.0, z: targetZ + 0.1 },
          },
        ],
      };
    case "foreign_true":
      return {
        players: [
          {
            uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
            name: claimedUsername,
            foreign: true,
            position: { x: targetX + 0.1, y: 82.0, z: targetZ + 0.1 },
          },
        ],
      };
    case "wrong_username_at_target":
      return {
        players: [
          {
            uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
            name: "SomeoneElse",
            foreign: false,
            position: { x: targetX + 0.1, y: 82.0, z: targetZ + 0.1 },
          },
        ],
      };
    case "online_elsewhere":
      return {
        players: [
          {
            uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
            name: claimedUsername,
            foreign: false,
            position: { x: 10.5, y: 82.0, z: 20.5 },
          },
        ],
      };
    case "malformed_player_entry":
      return {
        players: [
          { uuid: "not-a-uuid", name: claimedUsername, foreign: false },
          {
            uuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
            name: claimedUsername,
            foreign: false,
            position: { x: targetX + 0.1, y: 82.0, z: targetZ + 0.1 },
          },
        ],
      };
    default:
      return { players: [] };
  }
}

export function mockUiLabCheckMinecraftLocation(
  scenarioRaw?: string,
): LocationCheckResult {
  const scenario = resolveCheckScenario(scenarioRaw);

  if (scenario === "fully_verified") {
    return {
      outcome: "verified",
      user: {
        id: "ui-lab-user",
        discordId: "000000000000000000",
        discordUsername: "carter",
        avatarUrl: null,
        email: null,
        minecraftUsername: "carter",
        minecraftUuid: "3536c548-fbc9-4a0b-b570-ba816e78be54",
        minecraftVerifiedAt: new Date().toISOString(),
        eligibilityConfirmedAt: new Date().toISOString(),
        coreOnboardingCompletedAt: new Date().toISOString(),
        onboardingCompletedAt: new Date().toISOString(),
        tags: ["corporate_admin"],
        accountStatus: "active",
        internalAccess: true,
        companyMemberships: [],
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
      challenge: defaultChallenge({ status: "VERIFIED", verifiedAt: new Date().toISOString() }),
      verifiedUsername: "carter",
    };
  }

  if (scenario === "expired_challenge") {
    writeStoredChallenge(null);
    return {
      outcome: "expired",
      message: "These coordinates expired. Generate a new verification location.",
      challenge: null,
    };
  }

  if (scenario === "feed_timeout") {
    const challenge = readStoredChallenge() ?? defaultChallenge();
    return {
      outcome: "feed_delayed",
      message:
        "The live map may still be updating. Stay on the block and try again in a moment.",
      challenge,
    };
  }

  if (scenario === "malformed_json" || scenario === "server_error") {
    const challenge = readStoredChallenge() ?? defaultChallenge();
    return {
      outcome: "feed_unavailable",
      message:
        "DistrictRP’s live map is temporarily unavailable. Your verification coordinates are saved.",
      challenge,
    };
  }

  if (scenario === "duplicate_uuid") {
    const challenge = readStoredChallenge() ?? defaultChallenge();
    return {
      outcome: "username_linked",
      message: "That Minecraft account is already connected to another Alta account.",
      challenge,
    };
  }

  if (scenario === "concurrent_confirmation") {
    // Second call behaves as already verified (idempotent).
    return mockUiLabCheckMinecraftLocation("fully_verified");
  }

  const challenge = readStoredChallenge() ?? defaultChallenge();
  // Persist so refresh/poll continue against the same coordinates.
  if (!readStoredChallenge()) writeStoredChallenge(challenge);

  if (scenario === "malformed_json") {
    const parsed = parseBlueMapPlayersPayload("not-json");
    if (!parsed.ok) {
      return {
        outcome: "feed_unavailable",
        message:
          "DistrictRP’s live map is temporarily unavailable. Your verification coordinates are saved.",
        challenge,
      };
    }
  }

  const fixture = uiLabFeedFixture(scenario, challenge);
  const parsed = parseBlueMapPlayersPayload(fixture);
  if (!parsed.ok) {
    return {
      outcome: "feed_unavailable",
      message:
        "DistrictRP’s live map is temporarily unavailable. Your verification coordinates are saved.",
      challenge,
    };
  }

  const match = findClaimedPlayerMatch(
    parsed.players,
    challenge.claimedUsername,
    challenge.targetX,
    challenge.targetZ,
  );

  if (match.status === "offline") {
    return {
      outcome: "offline",
      message: `We couldn’t find ${challenge.claimedUsername} online. Join DistrictRP, then try again.`,
      challenge,
    };
  }
  if (match.status === "foreign") {
    return {
      outcome: "foreign",
      message: "Join the main DistrictRP world before verifying.",
      challenge,
    };
  }
  if (match.status === "wrong_block") {
    return {
      outcome: "wrong_block",
      message: `We found you online, but you aren’t on the verification block yet. Move to X ${challenge.targetX}, Z ${challenge.targetZ} and stay there while we check again.`,
      challenge,
    };
  }

  const verified = defaultChallenge({
    ...challenge,
    status: "VERIFIED",
    verifiedAt: new Date().toISOString(),
  });
  writeStoredChallenge(verified);

  return {
    outcome: "verified",
    user: {
      id: "ui-lab-user",
      discordId: "000000000000000000",
      discordUsername: "carter",
      avatarUrl: null,
      email: null,
      minecraftUsername: match.name,
      minecraftUuid: match.uuid,
      minecraftVerifiedAt: new Date().toISOString(),
      eligibilityConfirmedAt: new Date().toISOString(),
      coreOnboardingCompletedAt: new Date().toISOString(),
      onboardingCompletedAt: new Date().toISOString(),
      tags: ["corporate_admin"],
      accountStatus: "active",
      internalAccess: true,
      companyMemberships: [],
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    },
    challenge: verified,
    verifiedUsername: match.name,
  };
}

export { CHALLENGE_KEY as UI_LAB_MINECRAFT_CHALLENGE_KEY };
