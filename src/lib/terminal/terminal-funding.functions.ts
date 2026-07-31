import { createServerFn } from "@tanstack/react-start";
import type { BankActionUiLabScenario } from "@/lib/bank/bank-action-ui-lab";
import type { SubmitTerminalFundingTransferInput } from "@/lib/terminal/terminal-funding-types";

async function requireActor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

export const fetchTerminalFundingEligibility = createServerFn({ method: "GET" })
  .inputValidator((input: { uiLabScenario?: BankActionUiLabScenario } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const {
        assertUiLabTerminalFundingEligibilityScenario,
        getUiLabTerminalFundingEligibility,
      } = await import("@/lib/terminal/ui-lab/ui-lab-terminal-funding-fixtures");
      assertUiLabTerminalFundingEligibilityScenario(data.uiLabScenario ?? "success");
      return getUiLabTerminalFundingEligibility();
    }
    const user = await requireActor();
    const { listTerminalFundingEligibility } = await import(
      "@/server/terminal-funding.service"
    );
    return listTerminalFundingEligibility(user);
  });

export const submitTerminalFundingTransferFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: SubmitTerminalFundingTransferInput & { uiLabScenario?: BankActionUiLabScenario }) =>
      input,
  )
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { mockUiLabTerminalFundingSubmission } = await import(
        "@/lib/terminal/ui-lab/ui-lab-terminal-funding-fixtures"
      );
      const { uiLabScenario, ...payload } = data;
      return mockUiLabTerminalFundingSubmission(payload, uiLabScenario ?? "success");
    }
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Terminal funding transfer");

    const user = await requireActor();
    const { assertProductConsentForAction } = await import("@/server/product-consent-guard");
    await assertProductConsentForAction(user, "terminal.funding");

    const { assertUserRateLimit } = await import("@/server/rate-limit.service");
    assertUserRateLimit(user.id, "terminal-funding", 20, 60_000);

    const { submitTerminalFundingTransfer } = await import("@/server/terminal-funding.service");
    const { uiLabScenario: _ignored, ...payload } = data;
    void _ignored;
    return submitTerminalFundingTransfer(user, payload);
  });

export const fetchCustomerTerminalFundingTransfers = createServerFn({ method: "GET" })
  .inputValidator((limit: number | undefined) => limit ?? 40)
  .handler(async ({ data: limit }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { listUiLabTerminalFundingTransfers } = await import(
        "@/lib/terminal/ui-lab/ui-lab-terminal-funding-fixtures"
      );
      return listUiLabTerminalFundingTransfers();
    }
    const user = await requireActor();
    const { listCustomerTerminalFundingTransfers } = await import(
      "@/server/terminal-funding.service"
    );
    return listCustomerTerminalFundingTransfers(user, limit);
  });

export const fetchCustomerTerminalFundingTransfer = createServerFn({ method: "GET" })
  .inputValidator((transferId: string) => transferId)
  .handler(async ({ data: transferId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalFundingTransfer } = await import(
        "@/lib/terminal/ui-lab/ui-lab-terminal-funding-fixtures"
      );
      return getUiLabTerminalFundingTransfer(transferId);
    }
    const user = await requireActor();
    const { getCustomerTerminalFundingTransfer } = await import(
      "@/server/terminal-funding.service"
    );
    return getCustomerTerminalFundingTransfer(user, transferId);
  });

export const fetchInternalTerminalFundingTransfers = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      direction?: "BANK_TO_TERMINAL" | "TERMINAL_TO_BANK";
      status?: "PENDING" | "COMPLETED" | "FAILED";
      q?: string;
      limit?: number;
    }) => input ?? {},
  )
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { listUiLabTerminalFundingTransfers } = await import(
        "@/lib/terminal/ui-lab/ui-lab-terminal-funding-fixtures"
      );
      return listUiLabTerminalFundingTransfers(data);
    }
    const { listInternalTerminalFundingTransfers } = await import(
      "@/server/terminal-funding.service"
    );
    return listInternalTerminalFundingTransfers(data);
  });

export const fetchInternalTerminalFundingTransfer = createServerFn({ method: "GET" })
  .inputValidator((transferId: string) => transferId)
  .handler(async ({ data: transferId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalFundingTransfer } = await import(
        "@/lib/terminal/ui-lab/ui-lab-terminal-funding-fixtures"
      );
      return getUiLabTerminalFundingTransfer(transferId);
    }
    const { requireAuth } = await import("@/server/auth.service");
    const actor = await requireAuth();
    const { canAccessBankInternal, canAccessTerminalInternal } = await import(
      "@/lib/auth/permissions"
    );
    if (!canAccessBankInternal(actor) && !canAccessTerminalInternal(actor)) {
      throw new Error("FORBIDDEN");
    }
    const maskBank =
      canAccessTerminalInternal(actor) && !canAccessBankInternal(actor);
    const { getInternalTerminalFundingTransfer } = await import(
      "@/server/terminal-funding.service"
    );
    return getInternalTerminalFundingTransfer(transferId, {
      maskBankForTerminalStaff: maskBank,
    });
  });

/** Terminal-scoped read-only funding detail — never grants Bank permissions. */
export const fetchTerminalSafeFundingTransfer = createServerFn({ method: "GET" })
  .inputValidator((transferId: string) => transferId)
  .handler(async ({ data: transferId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabTerminalFundingTransfer } = await import(
        "@/lib/terminal/ui-lab/ui-lab-terminal-funding-fixtures"
      );
      const row = getUiLabTerminalFundingTransfer(transferId);
      if (!row) return null;
      return {
        ...row,
        bankAccountLabel: row.bankAccountMasked,
        bankTransactionId: null,
        bankTransactionReference: null,
      };
    }

    const { requireTerminalAdmin } = await import("@/server/permissions.service");
    await requireTerminalAdmin();
    const { getInternalTerminalFundingTransfer } = await import(
      "@/server/terminal-funding.service"
    );
    const { getTerminalOpsPortfolioFromDb } = await import(
      "@/lib/terminal/terminal-ops-admin.service"
    );
    const row = await getInternalTerminalFundingTransfer(transferId, {
      maskBankForTerminalStaff: true,
    });
    if (!row) return null;
    const portfolio = await getTerminalOpsPortfolioFromDb(row.portfolioId);
    if (!portfolio) throw new Error("FORBIDDEN");
    return {
      ...row,
      bankAccountLabel: row.bankAccountMasked,
      bankTransactionId: null,
      bankTransactionReference: null,
    };
  });
