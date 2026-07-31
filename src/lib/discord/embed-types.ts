/** Discord plain-message content limit (bot channel messages). */
export const DISCORD_MESSAGE_LIMITS = {
  content: 2000,
} as const;

export const DISCORD_EMBED_LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  maxFields: 25,
  footer: 2048,
  totalEmbed: 6000,
  authorName: 256,
  buttonLabel: 80,
} as const;

export type DiscordServerKey = "corporate" | "terminal" | "bank";

export type DiscordMessageDraft = {
  /** Which Discord bot / server to send through. */
  serverKey: DiscordServerKey | "";
  channelId: string;
  content: string;
};

export type SendDiscordMessageResult = {
  ok: boolean;
  mode: "sent" | "simulated";
  message: string;
  messageId?: string;
  validationErrors?: string[];
};

export type DiscordServerOption = {
  key: DiscordServerKey;
  label: string;
  envKey: string;
};

/** Communications bots — one token per Discord server (not guild ID). */
export const DISCORD_SERVERS: DiscordServerOption[] = [
  { key: "corporate", label: "Corporate", envKey: "DISCORD_CORPORATE_BOT_TOKEN" },
  { key: "terminal", label: "Terminal", envKey: "DISCORD_TERMINAL_BOT_TOKEN" },
  { key: "bank", label: "Bank", envKey: "DISCORD_BANK_BOT_TOKEN" },
];

export type EmbedTemplateKey =
  | "custom"
  | "alta_group_information"
  | "bank_notice"
  | "maintenance_notice";

export type EmbedColorPreset =
  | "alta_navy"
  | "alta_gold"
  | "success_green"
  | "warning_amber"
  | "risk_red"
  | "custom";

export const EMBED_COLOR_PRESETS: Record<
  Exclude<EmbedColorPreset, "custom">,
  { label: string; hex: string }
> = {
  alta_navy: { label: "Alta Navy", hex: "#06111F" },
  alta_gold: { label: "Alta Gold", hex: "#C9A45C" },
  success_green: { label: "Success Green", hex: "#047857" },
  warning_amber: { label: "Warning Amber", hex: "#D97706" },
  risk_red: { label: "Risk Red", hex: "#B91C1C" },
};

export const EMBED_TEMPLATES: { key: EmbedTemplateKey; label: string }[] = [
  { key: "custom", label: "Custom" },
  { key: "alta_group_information", label: "Alta Group Information" },
  { key: "bank_notice", label: "Bank Notice" },
  { key: "maintenance_notice", label: "Maintenance Notice" },
];

export type DiscordEmbedFieldDraft = {
  id: string;
  name: string;
  value: string;
  inline: boolean;
};

export type DiscordEmbedButtonDraft = {
  id: string;
  label: string;
  url: string;
};

export type DiscordEmbedDraft = {
  channelId: string;
  template: EmbedTemplateKey;
  colorPreset: EmbedColorPreset;
  customColorHex: string;
  authorName: string;
  authorIconUrl: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  imageUrl: string;
  fields: DiscordEmbedFieldDraft[];
  footerText: string;
  footerIconUrl: string;
  includeTimestamp: boolean;
  buttons: DiscordEmbedButtonDraft[];
};

export type DiscordEmbedPayload = {
  channelId: string;
  embed: Record<string, unknown>;
  components?: Record<string, unknown>[];
};

/** @deprecated Prefer SendDiscordMessageResult for plain-text sends. */
export type SendDiscordEmbedResult = SendDiscordMessageResult;
