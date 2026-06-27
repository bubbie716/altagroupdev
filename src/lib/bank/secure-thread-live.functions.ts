import { createServerFn } from "@tanstack/react-start";
import type { LoanApplicationThreadContext, LoanApplicationThreadMessageRow } from "@/lib/bank/loan-application-thread-types";
import { mapAltaCardThreadContextToLoan, mapAltaCardThreadMessagesToLoan } from "@/lib/bank/alta-card-thread-adapter";
import { mapAltaCardReviewThreadContextToLoan, mapAltaCardReviewThreadMessagesToLoan } from "@/lib/bank/alta-card-review-thread-adapter";

export type SecureThreadLiveProduct = "loan" | "alta-card" | "alta-card-review";

export type SecureThreadLivePollInput = {
  product: SecureThreadLiveProduct;
  threadId: string;
  variant: "user" | "internal";
};

export type SecureThreadLiveSnapshot = {
  context: LoanApplicationThreadContext;
  messages: LoanApplicationThreadMessageRow[];
};

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

/** Read-only poll — no thread creation side effects. */
export const pollSecureThreadLive = createServerFn({ method: "GET" })
  .inputValidator((input: SecureThreadLivePollInput) => input)
  .handler(async ({ data }): Promise<SecureThreadLiveSnapshot> => {
    const userId =
      data.variant === "internal" ? await requireInternalActorId() : await actorId();

    if (data.product === "loan") {
      const { getThreadContext, getThreadMessages } = await import(
        "@/server/loan-application-thread.service"
      );
      const [context, messages] = await Promise.all([
        getThreadContext(userId, data.threadId, data.variant),
        getThreadMessages(userId, data.threadId),
      ]);
      return { context, messages };
    }

    if (data.product === "alta-card") {
      const { getAltaCardThreadContext, getAltaCardThreadMessages } = await import(
        "@/server/alta-card-application-thread.service"
      );
      const [context, messages] = await Promise.all([
        getAltaCardThreadContext(userId, data.threadId, data.variant),
        getAltaCardThreadMessages(userId, data.threadId),
      ]);
      return {
        context: mapAltaCardThreadContextToLoan(context),
        messages: mapAltaCardThreadMessagesToLoan(messages),
      };
    }

    const { getReviewThreadContext, getReviewThreadMessages } = await import(
      "@/server/alta-card-review-thread.service"
    );
    const reviewRequestId = data.threadId;
    const [context, messages] = await Promise.all([
      getReviewThreadContext(userId, reviewRequestId, data.variant),
      getReviewThreadMessages(userId, reviewRequestId),
    ]);
    return {
      context: mapAltaCardReviewThreadContextToLoan(context),
      messages: mapAltaCardReviewThreadMessagesToLoan(messages),
    };
  });
