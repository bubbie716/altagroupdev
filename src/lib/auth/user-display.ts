import type { AltaUser } from "@/lib/auth/types";

export type UserDisplayIdentity = {
  discordUsername?: string | null;
  minecraftUsername?: string | null;
};

/** Discord handles arrive lowercase with separators; render them as a name instead. */
function humanizeHandle(handle: string): string {
  const cleaned = handle.trim().replace(/#\d{4}$/, "");
  if (!cleaned) return "";

  const words = cleaned
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((word) => (/^[a-z][a-z0-9]*$/.test(word) ? `${word[0].toUpperCase()}${word.slice(1)}` : word));

  return words.length > 0 ? words.join(" ") : cleaned;
}

/**
 * Primary customer-facing identity.
 * Prefer Minecraft username; fall back to a tidied Discord handle only when MC is absent.
 * Do not use this for fields labeled “Discord” / Discord ID / Discord OAuth.
 */
export function formatAltaUserDisplayName(user: UserDisplayIdentity): string {
  const minecraft = user.minecraftUsername?.trim();
  if (minecraft) return minecraft;
  return humanizeHandle(user.discordUsername ?? "");
}

/**
 * Same preference order as {@link formatAltaUserDisplayName}, but keeps the raw Discord
 * handle when Minecraft is missing (directories, audit actors, unique labels).
 */
export function formatAltaUserHandle(user: UserDisplayIdentity): string {
  const minecraft = user.minecraftUsername?.trim();
  if (minecraft) return minecraft;
  const discord = user.discordUsername?.trim();
  return discord || "";
}

/** Explicit Discord identity — use only in Discord-designated UI. */
export function formatDiscordUsername(user: Pick<AltaUser, "discordUsername"> | UserDisplayIdentity): string {
  return user.discordUsername?.trim() || "";
}

/** Initials from the primary display name (MC-first). */
export function formatAltaUserInitials(user: UserDisplayIdentity): string {
  const name = formatAltaUserDisplayName(user) || formatAltaUserHandle(user) || "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
