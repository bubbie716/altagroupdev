import { createServerFn } from "@tanstack/react-start";
import type {
  AssignThreadStaffInput,
  SendThreadMessageInput,
  UpdateThreadStatusInput,
} from "@/lib/bank/loan-application-thread-types";

async function actorId(): Promise<string> {
  const { requireAuth } = await import("@/server/auth.service");
  const user = await requireAuth();
  return user.id;
}

async function requireInternalActorId(): Promise<string> {
  const { requireOperator } = await import("@/server/permissions.service");
  const user = await requireOperator();
  return user.id;
}

export const fetchLoanApplicationThread = createServerFn({ method: "GET" })
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({ data: applicationId }) => {
    const { ensureThreadExists, getThreadContext, getThreadMessages } = await import(
      "@/server/loan-application-thread.service"
    );
    const userId = await actorId();
    await ensureThreadExists(userId, applicationId);
    const [context, messages] = await Promise.all([
      getThreadContext(userId, applicationId, "user"),
      getThreadMessages(userId, applicationId, "customer"),
    ]);
    return { context, messages };
  });

export const fetchInternalLoanApplicationThread = createServerFn({ method: "GET" })
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({ data: applicationId }) => {
    const { ensureThreadExists, getThreadContext, getThreadMessages } = await import(
      "@/server/loan-application-thread.service"
    );
    const userId = await requireInternalActorId();
    await ensureThreadExists(userId, applicationId);
    const [context, messages] = await Promise.all([
      getThreadContext(userId, applicationId, "internal"),
      getThreadMessages(userId, applicationId, "internal"),
    ]);
    return { context, messages };
  });

export const sendLoanApplicationThreadMessage = createServerFn({ method: "POST" })
  .inputValidator((input: SendThreadMessageInput) => input)
  .handler(async ({ data }) => {
    const { sendThreadMessage } = await import("@/server/loan-application-thread.service");
    const userId = await actorId();
    return sendThreadMessage(userId, data, "applicant");
  });

export const sendInternalLoanApplicationThreadMessage = createServerFn({ method: "POST" })
  .inputValidator((input: SendThreadMessageInput) => input)
  .handler(async ({ data }) => {
    const { sendThreadMessage } = await import("@/server/loan-application-thread.service");
    const userId = await requireInternalActorId();
    return sendThreadMessage(userId, data, "staff");
  });

export const updateLoanApplicationThreadStatus = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateThreadStatusInput) => input)
  .handler(async ({ data }) => {
    const { updateThreadStatus } = await import("@/server/loan-application-thread.service");
    const userId = await requireInternalActorId();
    return updateThreadStatus(userId, data);
  });

/** @deprecated V1 Secure Deal Rooms are not staff-assigned. No-op for compatibility. */
export const assignLoanApplicationThreadStaff = createServerFn({ method: "POST" })
  .inputValidator((input: AssignThreadStaffInput) => input)
  .handler(async ({ data }) => {
    const { assignThreadStaff } = await import("@/server/loan-application-thread.service");
    const userId = await requireInternalActorId();
    return assignThreadStaff(userId, data);
  });

export const closeLoanApplicationThread = createServerFn({ method: "POST" })
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({ data: applicationId }) => {
    const { closeThread } = await import("@/server/loan-application-thread.service");
    const userId = await requireInternalActorId();
    return closeThread(userId, applicationId);
  });

export const reopenLoanApplicationThread = createServerFn({ method: "POST" })
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({ data: applicationId }) => {
    const { reopenThread } = await import("@/server/loan-application-thread.service");
    const userId = await requireInternalActorId();
    return reopenThread(userId, applicationId);
  });

export const resyncLoanDealRoomDiscord = createServerFn({ method: "POST" })
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({ data: applicationId }) => {
    const { resyncDealRoomDiscordChannel } = await import("@/server/secure-deal-room-discord.service");
    const userId = await requireInternalActorId();
    return resyncDealRoomDiscordChannel(userId, "LOAN_APPLICATION", applicationId);
  });

export const ensureInternalLoanApplicationThread = createServerFn({ method: "POST" })
  .inputValidator((applicationId: string) => applicationId)
  .handler(async ({ data: applicationId }) => {
    const { ensureThreadForApplication } = await import("@/server/loan-application-thread.service");
    const userId = await requireInternalActorId();
    return ensureThreadForApplication(userId, applicationId);
  });
