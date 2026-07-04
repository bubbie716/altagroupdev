export const INVITE_PREFIX = "alta:invite";

export const INVITE_COLORS = {
  alta: 0x0f1729,
  altaPrivate: 0x8b7355,
  success: 0x047857,
  pending: 0xb45309,
  error: 0xb91c1c,
} as const;

export function notificationColorForTitle(title: string): number {
  const normalized = title.toLowerCase();
  if (normalized.includes("denied") || normalized.includes("declined")) {
    return INVITE_COLORS.error;
  }
  if (
    normalized.includes("approved") ||
    normalized.includes("complete") ||
    normalized.includes("received") ||
    normalized.includes("sent")
  ) {
    return normalized.includes("submitted") ? INVITE_COLORS.pending : INVITE_COLORS.success;
  }
  if (normalized.includes("submitted") || normalized.includes("pending")) {
    return INVITE_COLORS.pending;
  }
  return INVITE_COLORS.alta;
}

export function invitePrivateAcceptId(invitationId: string): string {
  return `${INVITE_PREFIX}:private:accept:${invitationId}`;
}

export function invitePrivateDeclineId(invitationId: string): string {
  return `${INVITE_PREFIX}:private:decline:${invitationId}`;
}

export function inviteCompanyAcceptId(invitationId: string): string {
  return `${INVITE_PREFIX}:company:accept:${invitationId}`;
}

export function inviteCompanyDeclineId(invitationId: string): string {
  return `${INVITE_PREFIX}:company:decline:${invitationId}`;
}

function formatCompanyRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type InvitationDmPayload = {
  embed: Record<string, unknown>;
  components: Record<string, unknown>[];
};

export function buildPrivateInvitationDmPayload(input: {
  invitationId: string;
  invitationMessage: string | null;
  invitedByUsername: string | null;
}): InvitationDmPayload {
  const description = [
    "You have been invited to **Alta Private**.",
    input.invitationMessage ? `\n> ${input.invitationMessage.slice(0, 500)}` : "",
    input.invitedByUsername ? `\nInvited by **${input.invitedByUsername}**.` : "",
    "",
    "Accept or decline below.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    embed: {
      title: "Alta Private invitation",
      description,
      color: INVITE_COLORS.altaPrivate,
      footer: { text: "Alta Private · Alta Bank" },
    },
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: "Accept",
            custom_id: invitePrivateAcceptId(input.invitationId),
          },
          {
            type: 2,
            style: 2,
            label: "Decline",
            custom_id: invitePrivateDeclineId(input.invitationId),
          },
        ],
      },
    ],
  };
}

export function buildCompanyInvitationDmPayload(input: {
  invitationId: string;
  companyName: string;
  role: string;
  invitedByUsername: string;
}): InvitationDmPayload {
  const description = [
    `You have been invited to join **${input.companyName}**.`,
    `**Role** ${formatCompanyRole(input.role)}`,
    `**Invited by** ${input.invitedByUsername}`,
    "",
    "Accept or decline below.",
  ].join("\n");

  return {
    embed: {
      title: "Company invitation",
      description,
      color: INVITE_COLORS.alta,
      footer: { text: "Alta Bank · Newport" },
    },
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: "Accept",
            custom_id: inviteCompanyAcceptId(input.invitationId),
          },
          {
            type: 2,
            style: 2,
            label: "Decline",
            custom_id: inviteCompanyDeclineId(input.invitationId),
          },
        ],
      },
    ],
  };
}

export function buildInvitationResultDmPayload(input: {
  title: string;
  description: string;
  isPrivate?: boolean;
}): InvitationDmPayload {
  const isSuccess =
    input.title.toLowerCase().includes("welcome") ||
    input.title.toLowerCase().includes("accepted");
  return {
    embed: {
      title: input.title,
      description: input.description,
      color: input.isPrivate
        ? INVITE_COLORS.altaPrivate
        : isSuccess
          ? INVITE_COLORS.success
          : INVITE_COLORS.alta,
      footer: {
        text: input.isPrivate ? "Alta Private · Alta Bank" : "Alta Bank · Newport",
      },
    },
    components: [],
  };
}

export function parseInvitationButtonId(customId: string): {
  kind: "private" | "company";
  action: "accept" | "decline";
  invitationId: string;
} | null {
  const match = customId.match(/^alta:invite:(private|company):(accept|decline):(.+)$/);
  if (!match) return null;
  return {
    kind: match[1] as "private" | "company",
    action: match[2] as "accept" | "decline",
    invitationId: match[3]!,
  };
}

export function isInvitationButton(customId: string): boolean {
  return customId.startsWith(`${INVITE_PREFIX}:`);
}
