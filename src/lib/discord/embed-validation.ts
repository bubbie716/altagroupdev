import {
  DISCORD_EMBED_LIMITS,
  type DiscordEmbedDraft,
} from "@/lib/discord/embed-types";
import { countEmbedCharacters, isValidDiscordChannelId, isValidHttpUrl, normalizeHex } from "@/lib/discord/embed-utils";

export type EmbedValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalCharacters: number;
};

function pushIfOver(errors: string[], label: string, value: string, max: number) {
  if (value.length > max) {
    errors.push(`${label} exceeds ${max} characters (${value.length}/${max}).`);
  }
}

export function validateEmbedDraft(draft: DiscordEmbedDraft): EmbedValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.title.trim() && !draft.description.trim()) {
    errors.push("Embed must include a title or description.");
  }

  if (!isValidDiscordChannelId(draft.channelId)) {
    errors.push("Channel ID must be a valid Discord snowflake (17–20 digits).");
  }

  pushIfOver(errors, "Title", draft.title, DISCORD_EMBED_LIMITS.title);
  pushIfOver(errors, "Description", draft.description, DISCORD_EMBED_LIMITS.description);
  pushIfOver(errors, "Author name", draft.authorName, DISCORD_EMBED_LIMITS.authorName);
  pushIfOver(errors, "Footer", draft.footerText, DISCORD_EMBED_LIMITS.footer);

  if (draft.fields.length > DISCORD_EMBED_LIMITS.maxFields) {
    errors.push(`Embed exceeds ${DISCORD_EMBED_LIMITS.maxFields} fields.`);
  }

  for (const [index, field] of draft.fields.entries()) {
    pushIfOver(errors, `Field ${index + 1} name`, field.name, DISCORD_EMBED_LIMITS.fieldName);
    pushIfOver(errors, `Field ${index + 1} value`, field.value, DISCORD_EMBED_LIMITS.fieldValue);
    if (!field.name.trim() || !field.value.trim()) {
      errors.push(`Field ${index + 1} requires both name and value.`);
    }
  }

  const totalCharacters = countEmbedCharacters(draft);
  if (totalCharacters > DISCORD_EMBED_LIMITS.totalEmbed) {
    errors.push(
      `Total embed content exceeds ${DISCORD_EMBED_LIMITS.totalEmbed} characters (${totalCharacters}/${DISCORD_EMBED_LIMITS.totalEmbed}).`,
    );
  }

  if (draft.colorPreset === "custom" && !normalizeHex(draft.customColorHex)) {
    errors.push("Custom color must be a valid hex value (e.g. #06111F).");
  }

  for (const label of ["Title URL", "Author icon", "Thumbnail", "Image", "Footer icon"] as const) {
    const value =
      label === "Title URL"
        ? draft.url
        : label === "Author icon"
          ? draft.authorIconUrl
          : label === "Thumbnail"
            ? draft.thumbnailUrl
            : label === "Image"
              ? draft.imageUrl
              : draft.footerIconUrl;
    if (!isValidHttpUrl(value)) {
      errors.push(`${label} must be a valid http(s) URL.`);
    }
  }

  for (const [index, button] of draft.buttons.entries()) {
    pushIfOver(errors, `Button ${index + 1} label`, button.label, DISCORD_EMBED_LIMITS.buttonLabel);
    if (!button.label.trim()) {
      errors.push(`Button ${index + 1} requires a label.`);
    }
    if (!isValidHttpUrl(button.url) || !button.url.trim()) {
      errors.push(`Button ${index + 1} requires a valid http(s) URL.`);
    }
  }

  if (draft.buttons.length > 0) {
    warnings.push("Buttons require bot message components — preview only until bot integration is live.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalCharacters,
  };
}
