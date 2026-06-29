import type { AltaPrivateInvitationStatusCode } from "./alta-private-types.ts";

export type InvitationRespondability =
  | { ok: true }
  | { ok: false; reason: "not_pending" | "expired" | "wrong_user" | "not_found" };

export function canRespondToAltaPrivateInvitation(input: {
  invitationUserId: string;
  actorUserId: string;
  status: AltaPrivateInvitationStatusCode;
  expiresAt: string | null;
  now?: Date;
}): InvitationRespondability {
  if (input.invitationUserId !== input.actorUserId) {
    return { ok: false, reason: "wrong_user" };
  }
  if (input.status !== "pending") {
    return { ok: false, reason: "not_pending" };
  }
  if (input.expiresAt) {
    const expires = new Date(input.expiresAt);
    const now = input.now ?? new Date();
    if (expires.getTime() < now.getTime()) {
      return { ok: false, reason: "expired" };
    }
  }
  return { ok: true };
}

export function canSendAltaPrivateInvitation(input: {
  membershipActive: boolean;
  hasPendingInvitation: boolean;
}): { ok: true } | { ok: false; reason: "already_member" | "pending_exists" } {
  if (input.membershipActive) return { ok: false, reason: "already_member" };
  if (input.hasPendingInvitation) return { ok: false, reason: "pending_exists" };
  return { ok: true };
}

export function canRevokeAltaPrivateInvitation(status: AltaPrivateInvitationStatusCode): boolean {
  return status === "pending";
}

export function goldCardEligibleForUser(isPrivateClient: boolean): boolean {
  return isPrivateClient;
}
