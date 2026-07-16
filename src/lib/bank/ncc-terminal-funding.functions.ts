import { createServerFn } from "@tanstack/react-start";

async function actorId(): Promise<string> {
  const { requireAuth } = await import("@/server/auth.service");
  const user = await requireAuth();
  return user.id;
}

export const fetchTerminalFundingSources = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await actorId();
  const { listPersonalFundingSourceAccounts, getCustomerTerminalCashSnapshot } = await import(
    "@/server/ncc/ncc-funding.service"
  );
  const [sourceAccounts, terminalCash] = await Promise.all([
    listPersonalFundingSourceAccounts(userId),
    getCustomerTerminalCashSnapshot(userId),
  ]);
  return { sourceAccounts, terminalCash };
});

export const fetchTerminalFundingHistory = createServerFn({ method: "GET" })
  .inputValidator((limit?: number) => (typeof limit === "number" ? limit : 20))
  .handler(async ({ data: limit }) => {
    const userId = await actorId();
    const { listCustomerTerminalFundingHistory } = await import("@/server/ncc/ncc-funding.service");
    return listCustomerTerminalFundingHistory(userId, limit);
  });

export const fetchTerminalFundingRequest = createServerFn({ method: "GET" })
  .inputValidator((requestId: string) => requestId)
  .handler(async ({ data: requestId }) => {
    const userId = await actorId();
    const { getCustomerTerminalFundingRequest } = await import("@/server/ncc/ncc-funding.service");
    return getCustomerTerminalFundingRequest(userId, requestId);
  });

export type SubmitTerminalFundingInput = {
  sourceBankAccountId: string;
  amount: string;
  currency?: string;
  idempotencyKey: string;
  memo?: string;
};

export const submitTerminalFundingTransfer = createServerFn({ method: "POST" })
  .inputValidator((input: SubmitTerminalFundingInput) => input)
  .handler(async ({ data }) => {
    const userId = await actorId();
    const { assertUserRateLimit } = await import("@/server/rate-limit.service");
    assertUserRateLimit(userId, "terminal-funding", 20, 60_000);

    const { submitCustomerTerminalFunding, NccFundingError, customerFundingErrorMessage } =
      await import("@/server/ncc/ncc-funding.service");

    try {
      return await submitCustomerTerminalFunding(userId, {
        sourceBankAccountId: data.sourceBankAccountId,
        amount: data.amount,
        currency: data.currency,
        idempotencyKey: data.idempotencyKey,
        memo: data.memo,
      });
    } catch (error) {
      if (error instanceof NccFundingError) {
        throw new Error(`BAD_REQUEST:${customerFundingErrorMessage(error.code)}`);
      }
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : null;
      if (code === "INSUFFICIENT_FUNDS") {
        throw new Error(`BAD_REQUEST:${customerFundingErrorMessage("INSUFFICIENT_FUNDS")}`);
      }
      if (code === "RATE_LIMITED") {
        throw new Error("BAD_REQUEST:Too many transfer attempts. Please wait a moment and try again.");
      }
      throw new Error(`BAD_REQUEST:${customerFundingErrorMessage(code)}`);
    }
  });
