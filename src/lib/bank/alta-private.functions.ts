import { createServerFn } from "@tanstack/react-start";
import type {
  AltaPrivateCustomerPageState,
  AltaPrivateInternalSummary,
  AltaPrivateInvitationSummary,
  PrivateBankingQueueRow,
} from "@/lib/bank/alta-private-types";

async function requireAuthId() {
  const { requireAuth } = await import("@/server/auth.service");
  return (await requireAuth()).id;
}

export const fetchCustomerAltaPrivatePageState = createServerFn({ method: "GET" }).handler(
  async (): Promise<AltaPrivateCustomerPageState> => {
    const { getCustomerAltaPrivatePageState } = await import(
      "@/server/alta-private-invitation.service"
    );
    const userId = await requireAuthId();
    return getCustomerAltaPrivatePageState(userId);
  },
);

export const fetchAltaPrivateInvitationRecord = createServerFn({ method: "GET" })
  .inputValidator((invitationId: string) => invitationId)
  .handler(async ({ data: invitationId }): Promise<AltaPrivateInvitationSummary> => {
    const { getAltaPrivateInvitationForUser } = await import(
      "@/server/alta-private-invitation.service"
    );
    const userId = await requireAuthId();
    return getAltaPrivateInvitationForUser(userId, invitationId);
  });

export const acceptAltaPrivateInvitationRecord = createServerFn({ method: "POST" })
  .inputValidator((invitationId: string) => invitationId)
  .handler(async ({ data: invitationId }) => {
    const { acceptAltaPrivateInvitation } = await import("@/server/alta-private-invitation.service");
    const userId = await requireAuthId();
    return acceptAltaPrivateInvitation(userId, invitationId);
  });

export const declineAltaPrivateInvitationRecord = createServerFn({ method: "POST" })
  .inputValidator((invitationId: string) => invitationId)
  .handler(async ({ data: invitationId }) => {
    const { declineAltaPrivateInvitation } = await import(
      "@/server/alta-private-invitation.service"
    );
    const userId = await requireAuthId();
    await declineAltaPrivateInvitation(userId, invitationId);
    return { ok: true as const };
  });

export const sendAltaPrivateInvitationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; invitationMessage: string }) => input)
  .handler(async ({ data }) => {
    const { sendAltaPrivateInvitation } = await import("@/server/alta-private-invitation.service");
    const actorUserId = await requireAuthId();
    return sendAltaPrivateInvitation(actorUserId, data);
  });

export const revokeAltaPrivateInvitationRecord = createServerFn({ method: "POST" })
  .inputValidator((input: { invitationId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { revokeAltaPrivateInvitation } = await import(
      "@/server/alta-private-invitation.service"
    );
    const actorUserId = await requireAuthId();
    await revokeAltaPrivateInvitation(actorUserId, data.invitationId, data.reason);
    return { ok: true as const };
  });

export const fetchInternalAltaPrivateSummaryRecord = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }): Promise<AltaPrivateInternalSummary> => {
    const { requireOperator } = await import("@/server/permissions.service");
    await requireOperator();
    const { getInternalAltaPrivateSummary } = await import(
      "@/server/alta-private-invitation.service"
    );
    return getInternalAltaPrivateSummary(userId);
  });

export const fetchPrivateBankingQueueRows = createServerFn({ method: "GET" }).handler(
  async (): Promise<PrivateBankingQueueRow[]> => {
    const { requireOperator } = await import("@/server/permissions.service");
    await requireOperator();
    const { listPrivateBankingQueueRows } = await import(
      "@/server/alta-private-invitation.service"
    );
    return listPrivateBankingQueueRows();
  },
);

export const fetchAltaPrivateClientContext = createServerFn({ method: "GET" }).handler(async () => {
  const { getAltaPrivateClientContext } = await import("@/server/alta-private-invitation.service");
  const userId = await requireAuthId();
  return getAltaPrivateClientContext(userId);
});
