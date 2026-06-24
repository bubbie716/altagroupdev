import {
  DISCORD_EMBED_LIMITS,
  EMBED_COLOR_PRESETS,
  type DiscordEmbedDraft,
  type EmbedColorPreset,
} from "@/lib/discord/embed-types";

export function resolveEmbedColorHex(draft: DiscordEmbedDraft): string {
  if (draft.colorPreset === "custom") {
    return normalizeHex(draft.customColorHex) ?? EMBED_COLOR_PRESETS.alta_navy.hex;
  }
  return EMBED_COLOR_PRESETS[draft.colorPreset].hex;
}

export function normalizeHex(input: string): string | null {
  const trimmed = input.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

export function hexToDiscordColor(hex: string): number {
  const normalized = normalizeHex(hex) ?? "#06111F";
  return Number.parseInt(normalized.slice(1), 16);
}

export function isValidHttpUrl(input: string): boolean {
  if (!input.trim()) return true;
  try {
    const url = new URL(input.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function countEmbedCharacters(draft: DiscordEmbedDraft): number {
  let total = 0;
  total += draft.title.length;
  total += draft.description.length;
  total += draft.authorName.length;
  total += draft.footerText.length;
  for (const f of draft.fields) {
    total += f.name.length + f.value.length;
  }
  return total;
}

export function presetFromHex(hex: string): EmbedColorPreset {
  const normalized = normalizeHex(hex);
  if (!normalized) return "custom";
  for (const [key, preset] of Object.entries(EMBED_COLOR_PRESETS)) {
    if (preset.hex.toUpperCase() === normalized) return key as EmbedColorPreset;
  }
  return "custom";
}

export function isValidDiscordChannelId(input: string): boolean {
  return /^\d{17,20}$/.test(input.trim());
}

export function normalizeChannelId(input: string): string {
  return input.trim();
}

export { DISCORD_EMBED_LIMITS };
