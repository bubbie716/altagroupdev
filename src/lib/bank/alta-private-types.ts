export type AltaPrivateInvitationStatusCode =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked"
  | "expired";

export type AltaPrivateInvitationSummary = {
  id: string;
  userId: string;
  status: AltaPrivateInvitationStatusCode;
  invitationMessage: string | null;
  invitedByUserId: string;
  invitedByUsername: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AltaPrivateCustomerPageState =
  | {
      kind: "member";
      activatedAt: string | null;
    }
  | {
      kind: "invited";
      invitation: AltaPrivateInvitationSummary;
    }
  | {
      kind: "declined";
      declinedAt: string | null;
    }
  | {
      kind: "aspirational";
      eligible: boolean;
    };

export type AltaPrivateInternalSummary = {
  membershipActive: boolean;
  eligible: boolean;
  pendingInvitation: AltaPrivateInvitationSummary | null;
  invitationHistory: AltaPrivateInvitationSummary[];
};

export type PrivateBankingQueueRow = {
  userId: string;
  discordUsername: string;
  discordId: string;
  email: string | null;
  totalBankBalance: number;
  bankAccountCount: number;
  accountStatus: string;
  createdAt: string;
  relationshipTier: string | null;
  altaPrivateEligible: boolean;
  altaPrivateActive: boolean;
  invitationStatus: AltaPrivateInvitationStatusCode | null;
  invitationId: string | null;
  invitationSentAt: string | null;
};
