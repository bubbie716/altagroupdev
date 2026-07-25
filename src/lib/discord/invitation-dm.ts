export const INVITE_PREFIX = "alta:invite";

export const INVITE_COLORS = {
  alta: 0x0f1729,
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
}): InvitationDmPayload {
  const isSuccess =
    input.title.toLowerCase().includes("welcome") ||
    input.title.toLowerCase().includes("accepted");
  return {
    embed: {
      title: input.title,
      description: input.description,
      color: isSuccess ? INVITE_COLORS.success : INVITE_COLORS.alta,
      footer: { text: "Alta Bank · Newport" },
    },
    components: [],
  };
}

export function parseInvitationButtonId(customId: string): {
  kind: "company";
  action: "accept" | "decline";
  invitationId: string;
} | null {
  const match = customId.match(/^alta:invite:(company):(accept|decline):(.+)$/);
  if (!match) return null;
  return {
    kind: match[1] as "company",
    action: match[2] as "accept" | "decline",
    invitationId: match[3]!,
  };
}

export function isInvitationButton(customId: string): boolean {
  return customId.startsWith(`${INVITE_PREFIX}:`);
}
