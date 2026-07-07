import { sealJson, unsealJson } from "@/server/crypto";

const HANDOFF_TTL_MS = 60_000;

export type SessionHandoffPayload = {
  sessionToken: string;
  exp: number;
};

export async function createSessionHandoffToken(sessionToken: string): Promise<string | null> {
  return sealJson({
    sessionToken,
    exp: Date.now() + HANDOFF_TTL_MS,
  } satisfies SessionHandoffPayload);
}

export async function readSessionHandoffToken(
  token: string,
): Promise<SessionHandoffPayload | null> {
  const parsed = await unsealJson<SessionHandoffPayload>(token);
  if (!parsed?.sessionToken || typeof parsed.exp !== "number") return null;
  if (parsed.exp < Date.now()) return null;
  return parsed;
}

export function stripWwwHost(host: string): string {
  const normalized = host.toLowerCase();
  return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
}

export function hostsMatch(a: string, b: string): boolean {
  return stripWwwHost(a) === stripWwwHost(b);
}
