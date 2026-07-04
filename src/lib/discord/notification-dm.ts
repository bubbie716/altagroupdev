import { INVITE_COLORS, notificationColorForTitle } from "@/lib/discord/invitation-dm";

export type NotificationDmPayload = {
  embed: Record<string, unknown>;
  components: Record<string, unknown>[];
};

export function resolvePublicLinkUrl(linkUrl?: string | null): string | undefined {
  const trimmed = linkUrl?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;

  const base =
    process.env.ALTA_WEB_BASE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const normalizedBase = base.replace(/\/$/, "");
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${normalizedBase}${path}`;
}

export function buildNotificationDmPayload(input: {
  title: string;
  body: string;
  linkUrl?: string | null;
  linkLabel?: string;
  embedImageUrl?: string | null;
}): NotificationDmPayload {
  const absoluteLink = resolvePublicLinkUrl(input.linkUrl);
  const description = input.body.slice(0, 4096);
  const imageUrl = input.embedImageUrl?.trim();

  const embed: Record<string, unknown> = {
    title: input.title.slice(0, 256),
    description,
    color: notificationColorForTitle(input.title),
    footer: { text: "Alta Bank · Newport" },
  };
  if (absoluteLink) {
    embed.url = absoluteLink;
  }
  if (imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))) {
    embed.image = { url: imageUrl };
  }

  const components: Record<string, unknown>[] = [];
  if (absoluteLink) {
    components.push({
      type: 1,
      components: [
        {
          type: 2,
          style: 5,
          label: (input.linkLabel ?? "View on Alta Bank").slice(0, 80),
          url: absoluteLink,
        },
      ],
    });
  }

  return { embed, components };
}

export function buildDealRoomOpenedDmPayload(input: {
  title: string;
  body: string;
  discordChannelUrl: string;
  websiteLinkUrl: string;
  websiteLinkLabel?: string;
}): NotificationDmPayload {
  const websiteUrl = resolvePublicLinkUrl(input.websiteLinkUrl);
  const description = input.body.slice(0, 4096);

  const embed: Record<string, unknown> = {
    title: input.title.slice(0, 256),
    description,
    url: input.discordChannelUrl,
    color: INVITE_COLORS.alta,
    footer: { text: "Alta Bank · Newport" },
  };

  const buttons: Record<string, unknown>[] = [
    {
      type: 2,
      style: 5,
      label: "Open channel",
      url: input.discordChannelUrl,
    },
  ];

  if (websiteUrl) {
    buttons.push({
      type: 2,
      style: 5,
      label: "Open Alta Bank",
      url: websiteUrl,
    });
  }

  return {
    embed,
    components: buttons.length > 0 ? [{ type: 1, components: buttons }] : [],
  };
}
