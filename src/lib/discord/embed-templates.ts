import {
  ALTA_EXCHANGE_TAGLINE,
  ALTA_TERMINAL_SUBTITLE,
  ALTA_TERMINAL_TAGLINE,
} from "@/lib/branding/alta-products";
import type { DiscordEmbedDraft, EmbedTemplateKey } from "@/lib/discord/embed-types";

function field(name: string, value: string, inline = false) {
  return { id: crypto.randomUUID(), name, value, inline };
}

export function applyEmbedTemplate(
  draft: DiscordEmbedDraft,
  template: EmbedTemplateKey,
): DiscordEmbedDraft {
  const base = { ...draft, template, fields: [] as DiscordEmbedDraft["fields"], buttons: [] as DiscordEmbedDraft["buttons"] };

  switch (template) {
    case "custom":
      return { ...draft, template };
    case "alta_group_information":
      return {
        ...base,
        colorPreset: "alta_navy",
        authorName: "Alta Group",
        title: "Alta Group",
        description: "Live Like The 1%",
        fields: [
          field("Alta Bank", "Bank Like The 1%"),
          field("Alta Exchange", ALTA_EXCHANGE_TAGLINE),
          field("Alta Terminal", `${ALTA_TERMINAL_TAGLINE} · ${ALTA_TERMINAL_SUBTITLE}`),
          field("NCC", "Future clearing and settlement infrastructure."),
        ],
        footerText: "Alta Group · Live Like The 1%",
      };
    case "bank_notice":
      return {
        ...base,
        colorPreset: "alta_gold",
        authorName: "Alta Bank",
        title: "Alta Bank Notice",
        description: "Enter the notice details for Alta Bank clients.",
        footerText: "Alta Bank · Bank Like The 1%",
      };
    case "exchange_notice":
      return {
        ...base,
        colorPreset: "alta_navy",
        authorName: "Alta Exchange",
        title: "Alta Exchange Notice",
        description: "Enter the notice details for market participants.",
        footerText: `Alta Exchange · ${ALTA_EXCHANGE_TAGLINE}`,
      };
    case "ipo_announcement":
      return {
        ...base,
        colorPreset: "success_green",
        authorName: "Alta Exchange",
        title: "IPO Announcement",
        description: "A new initial public offering has been filed on Alta Exchange.",
        fields: [
          field("Company", "—"),
          field("Ticker", "—"),
          field("Offering Price", "—"),
          field("Status", "Pending review"),
        ],
        footerText: "Alta Exchange · IPO Desk",
      };
    case "developer_api_update":
      return {
        ...base,
        colorPreset: "alta_navy",
        authorName: "Alta Exchange API",
        title: "Alta Exchange API Update",
        description: "Summarize the API change, affected endpoints, and effective date.",
        footerText: "Alta Exchange · Developer Platform",
      };
    case "maintenance_notice":
      return {
        ...base,
        colorPreset: "warning_amber",
        authorName: "Alta Operations",
        title: "Scheduled Maintenance",
        description: "Alta platforms will undergo scheduled maintenance.",
        fields: [
          field("Affected Services", "—"),
          field("Start Time", "—"),
          field("Expected Duration", "—"),
        ],
        footerText: "Alta Operations · Status",
      };
    default:
      return draft;
  }
}

export function createEmptyEmbedDraft(): DiscordEmbedDraft {
  return {
    channelId: "",
    template: "custom",
    colorPreset: "alta_navy",
    customColorHex: "#06111F",
    authorName: "Alta Group",
    authorIconUrl: "",
    title: "",
    description: "",
    url: "",
    thumbnailUrl: "",
    imageUrl: "",
    fields: [],
    footerText: "Alta Group · Live Like The 1%",
    footerIconUrl: "",
    includeTimestamp: true,
    buttons: [],
  };
}
