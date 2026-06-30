import { createServerFn } from "@tanstack/react-start";
import type {
  ProcessAltaCardReviewDecisionInput,
  SubmitAltaCardReviewInput,
} from "@/lib/bank/alta-card-review-types";
import type {
  SendAltaCardReviewThreadMessageInput,
  UpdateAltaCardReviewThreadStatusInput,
} from "@/lib/bank/alta-card-review-thread-types";

type ReviewThreadIdInput = { reviewRequestId?: string; applicationId?: string };

function normalizeReviewRequestId(input: ReviewThreadIdInput): string {
  const id = input.reviewRequestId ?? input.applicationId;
  if (!id) throw new Error("BAD_REQUEST:reviewRequestId is required");
  return id;
}

function parseServiceError(error: unknown): never {
  if (error instanceof Error && error.message.startsWith("BAD_REQUEST:")) {
    throw new Error(error.message.slice("BAD_REQUEST:".length));
  }
  throw error;
}

export const fetchAltaCardReviewFormContext = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { getReviewFormContext } = await import("@/server/alta-card-review.service");
    const user = await requireAuth();
    return getReviewFormContext(user.id, cardId);
  });

export const fetchAltaCardReviewEligibility = createServerFn({ method: "GET" })
  .inputValidator((cardId: string) => cardId)
  .handler(async ({ data: cardId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { getCardReviewEligibilityForUser } = await import("@/server/alta-card-review.service");
    const user = await requireAuth();
    return getCardReviewEligibilityForUser(user.id, cardId);
  });

export const submitAltaCardReviewRequest = createServerFn({ method: "POST" })
  .inputValidator((input: SubmitAltaCardReviewInput) => input)
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { submitReviewRequest } = await import("@/server/alta-card-review.service");
    const user = await requireAuth();
    return submitReviewRequest(user.id, data);
  });

export const fetchAltaCardReviewDetail = createServerFn({ method: "GET" })
  .inputValidator((reviewId: string) => reviewId)
  .handler(async ({ data: reviewId }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { getReviewRequestDetail } = await import("@/server/alta-card-review.service");
    const user = await requireAuth();
    return getReviewRequestDetail(user.id, reviewId);
  });

export const fetchInternalAltaCardReviewQueue = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requireOperator } = await import("@/server/permissions.service");
    await requireOperator();
    const { listInternalReviewQueue } = await import("@/server/alta-card-review.service");
    return listInternalReviewQueue();
  },
);

export const fetchInternalAltaCardReviewDetail = createServerFn({ method: "GET" })
  .inputValidator((reviewId: string) => reviewId)
  .handler(async ({ data: reviewId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const staff = await requireOperator();
    const { getInternalReviewDetail } = await import("@/server/alta-card-review.service");
    return getInternalReviewDetail(staff.id, reviewId);
  });

export const processAltaCardReviewDecision = createServerFn({ method: "POST" })
  .inputValidator((input: ProcessAltaCardReviewDecisionInput) => input)
  .handler(async ({ data }) => {
    try {
      const { requireOperator } = await import("@/server/permissions.service");
      const staff = await requireOperator();
      const { processReviewDecision } = await import("@/server/alta-card-review.service");
      return processReviewDecision(staff.id, data);
    } catch (error) {
      parseServiceError(error);
    }
  });

export const fetchAltaCardReviewThread = createServerFn({ method: "GET" })
  .inputValidator((reviewRequestId: string) => reviewRequestId)
  .handler(async ({ data: reviewRequestId }) => {
    const { ensureReviewThreadExists, getReviewThreadContext, getReviewThreadMessages } = await import(
      "@/server/alta-card-review-thread.service"
    );
    const { requireAuth } = await import("@/server/auth.service");
    const user = await requireAuth();
    await ensureReviewThreadExists(user.id, reviewRequestId);
    const [context, messages] = await Promise.all([
      getReviewThreadContext(user.id, reviewRequestId, "user"),
      getReviewThreadMessages(user.id, reviewRequestId, "customer"),
    ]);
    return { context, messages };
  });

export const fetchInternalAltaCardReviewThread = createServerFn({ method: "GET" })
  .inputValidator((reviewRequestId: string) => reviewRequestId)
  .handler(async ({ data: reviewRequestId }) => {
    const { ensureReviewThreadExists, getReviewThreadContext, getReviewThreadMessages } = await import(
      "@/server/alta-card-review-thread.service"
    );
    const { requireOperator } = await import("@/server/permissions.service");
    const staff = await requireOperator();
    await ensureReviewThreadExists(staff.id, reviewRequestId);
    const [context, messages] = await Promise.all([
      getReviewThreadContext(staff.id, reviewRequestId, "internal"),
      getReviewThreadMessages(staff.id, reviewRequestId, "internal"),
    ]);
    return { context, messages };
  });

export const sendAltaCardReviewThreadMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (input: SendAltaCardReviewThreadMessageInput & ReviewThreadIdInput) => ({
      reviewRequestId: normalizeReviewRequestId(input),
      body: input.body,
      attachments: input.attachments,
    }),
  )
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { sendReviewThreadMessage } = await import("@/server/alta-card-review-thread.service");
    const user = await requireAuth();
    return sendReviewThreadMessage(user.id, data, "applicant");
  });

export const sendInternalAltaCardReviewThreadMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (input: SendAltaCardReviewThreadMessageInput & ReviewThreadIdInput) => ({
      reviewRequestId: normalizeReviewRequestId(input),
      body: input.body,
      attachments: input.attachments,
    }),
  )
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { sendReviewThreadMessage } = await import("@/server/alta-card-review-thread.service");
    const staff = await requireOperator();
    return sendReviewThreadMessage(staff.id, data, "staff");
  });

export const updateAltaCardReviewThreadStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (input: UpdateAltaCardReviewThreadStatusInput & ReviewThreadIdInput) => ({
      reviewRequestId: normalizeReviewRequestId(input),
      status: input.status,
    }),
  )
  .handler(async ({ data }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { updateReviewThreadStatus } = await import("@/server/alta-card-review-thread.service");
    const staff = await requireOperator();
    return updateReviewThreadStatus(staff.id, data);
  });

export const closeAltaCardReviewThreadRecord = createServerFn({ method: "POST" })
  .inputValidator((reviewRequestId: string) => reviewRequestId)
  .handler(async ({ data: reviewRequestId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { closeReviewThread } = await import("@/server/alta-card-review-thread.service");
    const staff = await requireOperator();
    return closeReviewThread(staff.id, reviewRequestId);
  });

export const reopenAltaCardReviewThreadRecord = createServerFn({ method: "POST" })
  .inputValidator((reviewRequestId: string) => reviewRequestId)
  .handler(async ({ data: reviewRequestId }) => {
    const { requireOperator } = await import("@/server/permissions.service");
    const { reopenReviewThread } = await import("@/server/alta-card-review-thread.service");
    const staff = await requireOperator();
    return reopenReviewThread(staff.id, reviewRequestId);
  });
