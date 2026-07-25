import type { AltaUser } from "@/lib/auth/types";

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

/** Greeting-safe name: the Minecraft identity when known, otherwise a tidied Discord handle. */
export function formatAltaUserDisplayName(
  user: Pick<AltaUser, "discordUsername" | "minecraftUsername">,
): string {
  const minecraft = user.minecraftUsername?.trim();
  if (minecraft) return minecraft;
  return humanizeHandle(user.discordUsername ?? "");
}
