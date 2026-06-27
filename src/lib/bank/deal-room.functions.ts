import { createServerFn } from "@tanstack/react-start";
/**
 * Legacy deal room RPC wrappers. V1 lending application review uses
 * `loan-application-thread.functions.ts`. Kept for historical deal room records,
 * notifications (`fetchUserNotifications`), and agreement execution APIs.
 */
import type {
  AddDealRoomSystemUpdateInput,
  AssignDealRoomOfficerInput,
  CreateApplicantCounterOfferInput,
  CreateOfficerOfferInput,
  RejectDealRoomOfferInput,
  SendDealRoomMessageInput,
  UpdateDealRoomStatusInput,
} from "@/lib/bank/deal-room-types";

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

export const fetchUserDealRooms = createServerFn({ method: "GET" }).handler(async () => {
  /** @deprecated Legacy DealRoom model. Use LoanApplicationThread / Secure Deal Room instead. */
  const { getUserDealRooms } = await import("@/server/deal-room.service");
  const userId = await actorId();
  return getUserDealRooms(userId);
});

export const fetchDealRoomDetail = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getDealRoomDetail } = await import("@/server/deal-room.service");
    const userId = await actorId();
    return getDealRoomDetail(userId, dealRoomId);
  });

export const fetchDealRoomMessages = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getDealRoomMessages } = await import("@/server/deal-room.service");
    const userId = await actorId();
    return getDealRoomMessages(userId, dealRoomId);
  });

export const submitDealRoomMessage = createServerFn({ method: "POST" })
  .inputValidator((input: SendDealRoomMessageInput) => input)
  .handler(async ({ data }) => {
    const { sendDealRoomMessage } = await import("@/server/deal-room.service");
    const userId = await actorId();
    return sendDealRoomMessage(userId, { ...data, channel: data.channel ?? "applicant" });
  });

export const fetchInternalDealRooms = createServerFn({ method: "GET" }).handler(async () => {
  const { requireOperator } = await import("@/server/permissions.service");
  const { getInternalDealRooms } = await import("@/server/deal-room.service");
  await requireOperator();
  return getInternalDealRooms();
});

export const fetchInternalDealRoomDetail = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getDealRoomDetail } = await import("@/server/deal-room.service");
    const userId = await requireInternalActorId();
    return getDealRoomDetail(userId, dealRoomId);
  });

export const fetchInternalDealRoomMessages = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getDealRoomMessages } = await import("@/server/deal-room.service");
    const userId = await requireInternalActorId();
    return getDealRoomMessages(userId, dealRoomId);
  });

export const submitInternalDealRoomMessage = createServerFn({ method: "POST" })
  .inputValidator((input: SendDealRoomMessageInput) => input)
  .handler(async ({ data }) => {
    const { sendDealRoomMessage } = await import("@/server/deal-room.service");
    const userId = await requireInternalActorId();
    return sendDealRoomMessage(userId, data);
  });

export const submitDealRoomSystemUpdate = createServerFn({ method: "POST" })
  .inputValidator((input: AddDealRoomSystemUpdateInput) => input)
  .handler(async ({ data }) => {
    const { addDealRoomSystemUpdateFromInput } = await import("@/server/deal-room.service");
    const userId = await requireInternalActorId();
    return addDealRoomSystemUpdateFromInput(userId, data);
  });

export const deleteDealRoomMessageRecord = createServerFn({ method: "POST" })
  .inputValidator((messageId: string) => messageId)
  .handler(async ({ data: messageId }) => {
    const { softDeleteDealRoomMessage } = await import("@/server/deal-room.service");
    const userId = await actorId();
    await softDeleteDealRoomMessage(messageId, userId);
    return { ok: true as const };
  });

/** @deprecated Legacy DealRoom model. Use LoanApplicationThread / Secure Deal Room instead. */
export const createDealRoomForApplication = createServerFn({ method: "POST" })
  .inputValidator((loanApplicationId: string) => loanApplicationId)
  .handler(async ({ data: loanApplicationId }) => {
    const { createDealRoomForLoanApplication } = await import("@/server/deal-room.service");
    const userId = await actorId();
    return createDealRoomForLoanApplication(userId, loanApplicationId);
  });

/** @deprecated Legacy DealRoom model. Use LoanApplicationThread / Secure Deal Room instead. */
export const createInternalDealRoomForApplication = createServerFn({ method: "POST" })
  .inputValidator((loanApplicationId: string) => loanApplicationId)
  .handler(async ({ data: loanApplicationId }) => {
    const { createDealRoomForLoanApplication } = await import("@/server/deal-room.service");
    const userId = await requireInternalActorId();
    return createDealRoomForLoanApplication(userId, loanApplicationId);
  });

/** @deprecated Legacy DealRoom staff assignment. V1 Secure Deal Rooms are not staff-assigned. */
export const assignDealRoomOfficerRecord = createServerFn({ method: "POST" })
  .inputValidator((input: AssignDealRoomOfficerInput) => input)
  .handler(async ({ data }) => {
    const { assignDealRoomOfficer } = await import("@/server/deal-room.service");
    const userId = await requireInternalActorId();
    return assignDealRoomOfficer(userId, data.dealRoomId, data.officerUserId);
  });

export const updateDealRoomStatusRecord = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateDealRoomStatusInput) => input)
  .handler(async ({ data }) => {
    const { updateDealRoomStatus } = await import("@/server/deal-room.service");
    const userId = await requireInternalActorId();
    return updateDealRoomStatus(userId, data.dealRoomId, data.status);
  });

export const fetchDealRoomOffers = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getDealRoomOffers } = await import("@/server/deal-room-offer.service");
    const userId = await actorId();
    return getDealRoomOffers(userId, dealRoomId);
  });

export const fetchInternalDealRoomOffers = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getDealRoomOffers } = await import("@/server/deal-room-offer.service");
    const userId = await requireInternalActorId();
    return getDealRoomOffers(userId, dealRoomId);
  });

export const submitOfficerOffer = createServerFn({ method: "POST" })
  .inputValidator((input: CreateOfficerOfferInput) => input)
  .handler(async ({ data }) => {
    const { createOfficerOffer } = await import("@/server/deal-room-offer.service");
    const userId = await requireInternalActorId();
    return createOfficerOffer(userId, data);
  });

export const submitApplicantCounterOffer = createServerFn({ method: "POST" })
  .inputValidator((input: CreateApplicantCounterOfferInput) => input)
  .handler(async ({ data }) => {
    const { createApplicantCounterOffer } = await import("@/server/deal-room-offer.service");
    const userId = await actorId();
    return createApplicantCounterOffer(userId, data);
  });

export const acceptDealRoomOfferRecord = createServerFn({ method: "POST" })
  .inputValidator((offerId: string) => offerId)
  .handler(async ({ data: offerId }) => {
    const { acceptDealRoomOffer } = await import("@/server/deal-room-offer.service");
    const userId = await actorId();
    return acceptDealRoomOffer(offerId, userId);
  });

export const rejectDealRoomOfferRecord = createServerFn({ method: "POST" })
  .inputValidator((input: RejectDealRoomOfferInput) => input)
  .handler(async ({ data }) => {
    const { rejectDealRoomOffer } = await import("@/server/deal-room-offer.service");
    const userId = await actorId();
    return rejectDealRoomOffer(userId, data);
  });

export const withdrawDealRoomOfferRecord = createServerFn({ method: "POST" })
  .inputValidator((offerId: string) => offerId)
  .handler(async ({ data: offerId }) => {
    const { withdrawDealRoomOffer } = await import("@/server/deal-room-offer.service");
    const userId = await actorId();
    return withdrawDealRoomOffer(offerId, userId);
  });

export const fetchDealRoomDocuments = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getDocuments } = await import("@/server/deal-room.service");
    const userId = await actorId();
    return getDocuments(userId, dealRoomId);
  });

export const fetchInternalDealRoomDocuments = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getDocuments } = await import("@/server/deal-room.service");
    const userId = await requireInternalActorId();
    return getDocuments(userId, dealRoomId);
  });

export const deleteDealRoomDocumentRecord = createServerFn({ method: "POST" })
  .inputValidator((documentId: string) => documentId)
  .handler(async ({ data: documentId }) => {
    const { deleteDocument } = await import("@/server/deal-room.service");
    const userId = await actorId();
    await deleteDocument(userId, documentId);
    return { ok: true as const };
  });

export const requestDealRoomDocumentRecord = createServerFn({ method: "POST" })
  .inputValidator(
    (input: import("@/lib/bank/deal-room-types").RequestDealRoomDocumentInput) => input,
  )
  .handler(async ({ data }) => {
    const { requestDocument } = await import("@/server/deal-room.service");
    const userId = await requireInternalActorId();
    await requestDocument(userId, data);
    return { ok: true as const };
  });

export const reviewDealRoomDocumentRequestRecord = createServerFn({ method: "POST" })
  .inputValidator(
    (input: import("@/lib/bank/deal-room-types").ReviewDealRoomDocumentRequestInput) => input,
  )
  .handler(async ({ data }) => {
    const { reviewDocumentRequest } = await import("@/server/deal-room.service");
    const userId = await requireInternalActorId();
    await reviewDocumentRequest(userId, data);
    return { ok: true as const };
  });

export const fetchDealRoomAgreement = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getAgreementWorkspace } = await import("@/server/deal-room-agreement.service");
    const userId = await actorId();
    return getAgreementWorkspace(userId, dealRoomId);
  });

export const fetchInternalDealRoomAgreement = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getAgreementWorkspace } = await import("@/server/deal-room-agreement.service");
    const userId = await requireInternalActorId();
    return getAgreementWorkspace(userId, dealRoomId);
  });

export const saveDealRoomAgreementWorkspace = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/agreements/agreement-types").SaveAgreementWorkspaceInput) => input)
  .handler(async ({ data }) => {
    const { saveAgreementWorkspace } = await import("@/server/deal-room-agreement.service");
    const userId = await requireInternalActorId();
    return saveAgreementWorkspace(userId, data);
  });

export const generateDealRoomAgreementDraft = createServerFn({ method: "POST" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { generateAgreementDraft } = await import("@/server/deal-room-agreement.service");
    const userId = await requireInternalActorId();
    return generateAgreementDraft(userId, dealRoomId);
  });

export const prepareNewDealRoomAgreementDraft = createServerFn({ method: "POST" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { prepareNewAgreementDraftVersion } = await import("@/server/deal-room-agreement.service");
    const userId = await requireInternalActorId();
    return prepareNewAgreementDraftVersion(userId, dealRoomId);
  });

export const voidDealRoomAgreementDraft = createServerFn({ method: "POST" })
  .inputValidator((draftId: string) => draftId)
  .handler(async ({ data: draftId }) => {
    const { voidAgreementDraft } = await import("@/server/deal-room-agreement.service");
    const userId = await requireInternalActorId();
    return voidAgreementDraft(userId, draftId);
  });

export const signDealRoomAgreementBorrower = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/agreements/agreement-types").SignAgreementInput) => input)
  .handler(async ({ data }) => {
    const { signAgreementAsBorrower } = await import("@/server/deal-room-agreement.service");
    const userId = await actorId();
    return signAgreementAsBorrower(userId, data, null);
  });

export const signDealRoomAgreementBank = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/agreements/agreement-types").SignAgreementInput) => input)
  .handler(async ({ data }) => {
    const { signAgreementAsBank } = await import("@/server/deal-room-agreement.service");
    const userId = await requireInternalActorId();
    return signAgreementAsBank(userId, data, null);
  });

export const fetchDealRoomExecutionSummary = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getDealRoomExecutionSummary } = await import("@/server/deal-room-loan-execution.service");
    const userId = await actorId();
    return getDealRoomExecutionSummary(userId, dealRoomId);
  });

export const fetchDealRoomOperationsDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { getDealRoomOperationsDashboard } = await import("@/server/deal-room-ops.service");
  const userId = await requireInternalActorId();
  return getDealRoomOperationsDashboard(userId);
});

export const fetchDealRoomOpsContext = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getDealRoomOpsContext } = await import("@/server/deal-room-ops.service");
    const userId = await requireInternalActorId();
    return getDealRoomOpsContext(userId, dealRoomId);
  });

export const fetchDealRoomOfficers = createServerFn({ method: "GET" }).handler(async () => {
  const { listDealRoomOfficers } = await import("@/server/deal-room-ops.service");
  await requireInternalActorId();
  return listDealRoomOfficers();
});

export const fetchDealRoomTimeline = createServerFn({ method: "GET" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { getDealRoomTimeline } = await import("@/server/deal-room-ops.service");
    const userId = await requireInternalActorId();
    return getDealRoomTimeline(userId, dealRoomId);
  });

export const createDealRoomTaskRecord = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/bank/deal-room-ops-types").CreateDealRoomTaskInput) => input)
  .handler(async ({ data }) => {
    const { createDealRoomTask } = await import("@/server/deal-room-ops.service");
    const userId = await requireInternalActorId();
    return createDealRoomTask(userId, data);
  });

export const updateDealRoomTaskRecord = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/bank/deal-room-ops-types").UpdateDealRoomTaskInput) => input)
  .handler(async ({ data }) => {
    const { updateDealRoomTask } = await import("@/server/deal-room-ops.service");
    const userId = await requireInternalActorId();
    return updateDealRoomTask(userId, data);
  });

export const updateDealRoomWorkflowRecord = createServerFn({ method: "POST" })
  .inputValidator((input: import("@/lib/bank/deal-room-ops-types").UpdateDealRoomWorkflowInput) => input)
  .handler(async ({ data }) => {
    const { updateDealRoomWorkflow } = await import("@/server/deal-room-ops.service");
    const userId = await requireInternalActorId();
    await updateDealRoomWorkflow(userId, data);
    return { ok: true as const };
  });

export const unassignDealRoomOfficerRecord = createServerFn({ method: "POST" })
  .inputValidator((dealRoomId: string) => dealRoomId)
  .handler(async ({ data: dealRoomId }) => {
    const { unassignDealRoomOfficer } = await import("@/server/deal-room-ops.service");
    const userId = await requireInternalActorId();
    await unassignDealRoomOfficer(userId, dealRoomId);
    return { ok: true as const };
  });

export const fetchUserNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { getUserNotifications } = await import("@/server/notification.service");
  const userId = await actorId();
  return getUserNotifications(userId);
});

export const markNotificationReadRecord = createServerFn({ method: "POST" })
  .inputValidator((notificationId: string) => notificationId)
  .handler(async ({ data: notificationId }) => {
    const { markNotificationRead } = await import("@/server/notification.service");
    const userId = await actorId();
    await markNotificationRead(userId, notificationId);
    return { ok: true as const };
  });
