/**
 * Server-only DistrictRP BlueMap live-player feed client.
 * Never fetch from the browser. Never return the raw player list to clients.
 */
import {
  MINECRAFT_FEED_TIMEOUT_MS,
  matchesExactVerificationBlock,
} from "@/lib/onboarding/minecraft-verification-zone";

export const DISTRICTRP_BLUEMAP_PLAYERS_URL =
  "https://map.districtrp.xyz/maps/world/live/players.json" as const;

export type BlueMapPlayer = {
  uuid: string;
  name: string;
  foreign: boolean;
  position: { x: number; z: number };
};

export type FeedFetchResult =
  | { ok: true; players: BlueMapPlayer[] }
  | { ok: false; reason: "unavailable" | "timeout" | "malformed" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidMinecraftUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function parsePlayerEntry(raw: unknown): BlueMapPlayer | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;
  if (typeof entry.uuid !== "string" || !isValidMinecraftUuid(entry.uuid)) return null;
  if (typeof entry.name !== "string" || !entry.name.trim()) return null;
  if (typeof entry.foreign !== "boolean") return null;
  if (!entry.position || typeof entry.position !== "object" || Array.isArray(entry.position)) {
    return null;
  }
  const position = entry.position as Record<string, unknown>;
  if (typeof position.x !== "number" || !Number.isFinite(position.x)) return null;
  if (typeof position.z !== "number" || !Number.isFinite(position.z)) return null;
  // Y and rotation intentionally ignored.
  return {
    uuid: entry.uuid,
    name: entry.name,
    foreign: entry.foreign,
    position: { x: position.x, z: position.z },
  };
}

/** Validate top-level feed JSON. Malformed payload → unavailable/malformed. */
export function parseBlueMapPlayersPayload(payload: unknown): FeedFetchResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, reason: "malformed" };
  }
  const root = payload as Record<string, unknown>;
  if (!Array.isArray(root.players)) {
    return { ok: false, reason: "malformed" };
  }

  const players: BlueMapPlayer[] = [];
  for (const entry of root.players) {
    const parsed = parsePlayerEntry(entry);
    if (parsed) players.push(parsed);
  }
  return { ok: true, players };
}

export type ClaimedPlayerMatch =
  | { status: "offline" }
  | { status: "foreign" }
  | { status: "wrong_block" }
  | {
      status: "exact_match";
      uuid: string;
      name: string;
      blockX: number;
      blockZ: number;
    };

export function findClaimedPlayerMatch(
  players: BlueMapPlayer[],
  claimedUsername: string,
  targetX: number,
  targetZ: number,
): ClaimedPlayerMatch {
  const needle = claimedUsername.trim().toLowerCase();
  const matches = players.filter((p) => p.name.trim().toLowerCase() === needle);
  if (matches.length === 0) return { status: "offline" };

  // Prefer a non-foreign exact match if multiple entries exist.
  const nonForeign = matches.filter((p) => p.foreign === false);
  if (nonForeign.length === 0) return { status: "foreign" };

  for (const player of nonForeign) {
    if (matchesExactVerificationBlock(player.position.x, player.position.z, targetX, targetZ)) {
      return {
        status: "exact_match",
        uuid: player.uuid,
        name: player.name,
        blockX: Math.floor(player.position.x),
        blockZ: Math.floor(player.position.z),
      };
    }
  }

  return { status: "wrong_block" };
}

export async function fetchBlueMapPlayers(options?: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<FeedFetchResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? MINECRAFT_FEED_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(DISTRICTRP_BLUEMAP_PLAYERS_URL, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: "unavailable" };
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { ok: false, reason: "malformed" };
    }

    return parseBlueMapPlayersPayload(json);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

export function sanitizeClaimedMinecraftUsername(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 32) return null;
  // Reject control characters; allow DistrictRP/Geyser/Bedrock naming beyond Java-only regex.
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return null;
  }
  return trimmed;
}
