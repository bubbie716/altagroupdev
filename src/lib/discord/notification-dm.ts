import { INVITE_COLORS } from "@/lib/discord/invitation-dm";

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
    color: INVITE_COLORS.alta,
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
