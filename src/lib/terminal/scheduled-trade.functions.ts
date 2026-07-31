import { createServerFn } from "@tanstack/react-start";
import type {
  CreateScheduledTradeInput,
  ScheduledTradePreviewInput,
} from "@/lib/terminal/scheduled-trade-types";

async function requireTerminalUser() {
  const { isUiLabMode, getUiLabUserIfEnabled } = await import("@/lib/auth/ui-lab");
  if (isUiLabMode()) {
    const labUser = getUiLabUserIfEnabled();
    if (labUser) return labUser;
  }
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

export const previewScheduledTradeFn = createServerFn({ method: "POST" })
  .inputValidator((input: ScheduledTradePreviewInput) => input)
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { previewUiLabScheduledTrade } = await import(
        "@/lib/terminal/ui-lab/ui-lab-scheduled-trade-fixtures"
      );
      return previewUiLabScheduledTrade(data);
    }
    const user = await requireTerminalUser();
    const { previewCreateScheduledTrade } = await import(
      "@/server/terminal-scheduled-trade.service"
    );
    return previewCreateScheduledTrade(user, data);
  });

export const createScheduledTradeFn = createServerFn({ method: "POST" })
  .inputValidator(
    (
      input: CreateScheduledTradeInput & {
        uiLabScenario?: string;
        uiLabProductConsentScenario?: string;
        uiLabAcceptedOverlay?: {
          user: Partial<Record<import("@/lib/legal/consent-scopes").LegalConsentScopeId, true>>;
          companies: Record<string, true>;
        } | null;
      },
    ) => input,
  )
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { assertUiLabProductConsentForAction } = await import(
        "@/lib/legal/ui-lab-action-consent"
      );
      const { isTerminalCryptoSymbol } = await import(
        "@/lib/terminal/crypto/crypto-instrument"
      );
      const crypto =
        data.instrumentKind === "CRYPTO" || isTerminalCryptoSymbol(data.symbol);
      assertUiLabProductConsentForAction(
        crypto ? "terminal.crypto_trade" : "terminal.place_order",
        {
          uiLabScenario: data.uiLabProductConsentScenario,
          uiLabAcceptedOverlay: data.uiLabAcceptedOverlay,
        },
      );
      const { mockUiLabScheduledTradeCreate } = await import(
        "@/lib/terminal/ui-lab/ui-lab-scheduled-trade-fixtures"
      );
      const {
        uiLabScenario,
        uiLabProductConsentScenario: _pcs,
        uiLabAcceptedOverlay: _overlay,
        ...payload
      } = data;
      void _pcs;
      void _overlay;
      return mockUiLabScheduledTradeCreate(
        payload,
        (uiLabScenario as import("@/lib/bank/bank-action-ui-lab").BankActionUiLabScenario) ??
          "success",
      );
    }

    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Scheduled trade creation");

    const user = await requireTerminalUser();
    const { assertProductConsentForAction } = await import("@/server/product-consent-guard");
    const { isTerminalCryptoSymbol } = await import(
      "@/lib/terminal/crypto/crypto-instrument"
    );
    const crypto =
      data.instrumentKind === "CRYPTO" || isTerminalCryptoSymbol(data.symbol);
    await assertProductConsentForAction(
      user,
      crypto ? "terminal.crypto_trade" : "terminal.place_order",
    );

    const { assertUserRateLimit } = await import("@/server/rate-limit.service");
    assertUserRateLimit(user.id, "terminal-scheduled-trade", 20, 60_000);

    const { createScheduledTrade } = await import("@/server/terminal-scheduled-trade.service");
    const {
      uiLabScenario: _ignored,
      uiLabProductConsentScenario: _pcs2,
      uiLabAcceptedOverlay: _overlay2,
      ...payload
    } = data;
    void _ignored;
    void _pcs2;
    void _overlay2;
    return createScheduledTrade(user, payload);
  });

export const fetchScheduledTradesFn = createServerFn({ method: "GET" })
  .inputValidator((portfolioId: string | undefined) => portfolioId)
  .handler(async ({ data: portfolioId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { listUiLabScheduledTrades } = await import(
        "@/lib/terminal/ui-lab/ui-lab-scheduled-trade-fixtures"
      );
      return listUiLabScheduledTrades(portfolioId);
    }
    const user = await requireTerminalUser();
    const { listScheduledTradesForUser } = await import(
      "@/server/terminal-scheduled-trade.service"
    );
    return listScheduledTradesForUser(user, portfolioId);
  });

export const fetchScheduledTradeDetailFn = createServerFn({ method: "GET" })
  .inputValidator((instructionId: string) => instructionId)
  .handler(async ({ data: instructionId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabScheduledTradeDetail } = await import(
        "@/lib/terminal/ui-lab/ui-lab-scheduled-trade-fixtures"
      );
      const row = getUiLabScheduledTradeDetail(instructionId);
      if (!row) throw new Error("NOT_FOUND");
      return row;
    }
    const user = await requireTerminalUser();
    const { getScheduledTradeDetail } = await import(
      "@/server/terminal-scheduled-trade.service"
    );
    return getScheduledTradeDetail(user, instructionId);
  });

export const pauseScheduledTradeFn = createServerFn({ method: "POST" })
  .inputValidator((instructionId: string) => instructionId)
  .handler(async ({ data: instructionId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { mockUiLabScheduledTradePause } = await import(
        "@/lib/terminal/ui-lab/ui-lab-scheduled-trade-fixtures"
      );
      return mockUiLabScheduledTradePause(instructionId);
    }
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Scheduled trade pause");
    const user = await requireTerminalUser();
    const { pauseScheduledTrade } = await import("@/server/terminal-scheduled-trade.service");
    return pauseScheduledTrade(user, instructionId);
  });

export const resumeScheduledTradeFn = createServerFn({ method: "POST" })
  .inputValidator((instructionId: string) => instructionId)
  .handler(async ({ data: instructionId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { mockUiLabScheduledTradeResume } = await import(
        "@/lib/terminal/ui-lab/ui-lab-scheduled-trade-fixtures"
      );
      return mockUiLabScheduledTradeResume(instructionId);
    }
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Scheduled trade resume");
    const user = await requireTerminalUser();
    const { resumeScheduledTrade } = await import("@/server/terminal-scheduled-trade.service");
    return resumeScheduledTrade(user, instructionId);
  });

export const cancelScheduledTradeFn = createServerFn({ method: "POST" })
  .inputValidator((instructionId: string) => instructionId)
  .handler(async ({ data: instructionId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { mockUiLabScheduledTradeCancel } = await import(
        "@/lib/terminal/ui-lab/ui-lab-scheduled-trade-fixtures"
      );
      return mockUiLabScheduledTradeCancel(instructionId);
    }
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Scheduled trade cancel");
    const user = await requireTerminalUser();
    const { cancelScheduledTrade } = await import("@/server/terminal-scheduled-trade.service");
    return cancelScheduledTrade(user, instructionId);
  });

export const fetchScheduledTradeOccurrencesFn = createServerFn({ method: "GET" })
  .inputValidator((instructionId: string) => instructionId)
  .handler(async ({ data: instructionId }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabScheduledTradeDetail } = await import(
        "@/lib/terminal/ui-lab/ui-lab-scheduled-trade-fixtures"
      );
      const row = getUiLabScheduledTradeDetail(instructionId);
      return row?.recentOccurrences ?? [];
    }
    const user = await requireTerminalUser();
    const { listScheduledTradeOccurrences } = await import(
      "@/server/terminal-scheduled-trade.service"
    );
    return listScheduledTradeOccurrences(user, instructionId);
  });
