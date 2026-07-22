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

export type DiscordChannelKey =
  | "information"
  | "announcements"
  | "bank_notices"
  | "terminal_updates"
  | "developer_updates"
  | "internal_log";

export type EmbedTemplateKey =
  | "custom"
  | "alta_group_information"
  | "bank_notice"
  | "ipo_announcement"
  | "developer_api_update"
  | "maintenance_notice";

export type EmbedColorPreset =
  | "alta_navy"
  | "alta_gold"
  | "success_green"
  | "warning_amber"
  | "risk_red"
  | "custom";

export const DISCORD_CHANNELS: {
  key: DiscordChannelKey;
  label: string;
  mockId: string;
  envKey: string;
}[] = [
  { key: "information", label: "#information", mockId: "1000000000000000001", envKey: "DISCORD_CHANNEL_INFORMATION" },
  { key: "announcements", label: "#announcements", mockId: "1000000000000000002", envKey: "DISCORD_CHANNEL_ANNOUNCEMENTS" },
  { key: "bank_notices", label: "#bank-notices", mockId: "1000000000000000003", envKey: "DISCORD_CHANNEL_BANK_NOTICES" },
  { key: "terminal_updates", label: "#terminal-updates", mockId: "1000000000000000005", envKey: "DISCORD_CHANNEL_TERMINAL_UPDATES" },
  { key: "developer_updates", label: "#developer-updates", mockId: "1000000000000000006", envKey: "DISCORD_CHANNEL_DEVELOPER_UPDATES" },
  { key: "internal_log", label: "#internal-log", mockId: "1000000000000000007", envKey: "DISCORD_CHANNEL_INTERNAL_LOG" },
];

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
  { key: "ipo_announcement", label: "IPO Announcement" },
  { key: "developer_api_update", label: "Developer API Update" },
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

export type SendDiscordEmbedResult = {
  ok: boolean;
  mode: "sent" | "simulated";
  message: string;
  messageId?: string;
  validationErrors?: string[];
};
