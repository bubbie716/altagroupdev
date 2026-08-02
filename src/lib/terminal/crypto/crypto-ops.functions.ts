/**
 * Server functions for Alta Terminal crypto operations (Phase 4).
 * UI routes are separate — this wires permissioned handlers only.
 */
import { createServerFn } from "@tanstack/react-start";
import type { TerminalCryptoAssetStatus } from "@prisma/client";
import { CryptoOpsError, cryptoOpsCustomerMessage } from "./crypto-ops-errors";
import type { CryptoContributionKind } from "./crypto-contribution.service";

function toClientError(error: unknown): {
  ok: false;
  code: string;
  message: string;
  details?: Record<string, string>;
} {
  if (error instanceof CryptoOpsError) {
    return {
      ok: false,
      code: error.code,
      message: error.customerMessage,
      details: error.details,
    };
  }
  if (error instanceof Error) {
    if (error.message.startsWith("BAD_REQUEST:")) {
      return {
        ok: false,
        code: "UI_LAB_BLOCKED",
        message: cryptoOpsCustomerMessage("UI_LAB_BLOCKED"),
      };
    }
    if (error.message === "FORBIDDEN") {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: cryptoOpsCustomerMessage("FORBIDDEN"),
      };
    }
  }
  return {
    ok: false,
    code: "INTERNAL_FAILURE",
    message: cryptoOpsCustomerMessage("INTERNAL_FAILURE"),
  };
}

async function requireTerminalOps() {
  const { requireTerminalAdmin } = await import("@/server/permissions.service");
  return requireTerminalAdmin();
}

async function requireCorporateOps() {
  const { requireAdmin } = await import("@/server/permissions.service");
  return requireAdmin();
}

/**
 * Capability matrix mapped onto existing tags (no parallel role system):
 * - terminal_admin → trading/market operator (halt, redemption-only, reconcile, resolve issues)
 * - corporate_admin → senior + finance (activate/resume/close, sweep, contribute, fees, reopen)
 * - UI Lab → demonstration read-only (all mutations blocked)
 */
export type CryptoOpsActorCapabilities = {
  canHalt: boolean;
  canActivate: boolean;
  canSweep: boolean;
  canContribute: boolean;
  canReconcile: boolean;
  canConfigureFees: boolean;
  canResolveIssues: boolean;
  canReopenIssues: boolean;
  /** trading_market | finance_senior | demonstration */
  operatorRole: "trading_market" | "finance_senior" | "demonstration";
  isCorporateAdmin: boolean;
  uiLab: boolean;
};

async function resolveCapabilities(): Promise<CryptoOpsActorCapabilities> {
  const { isUiLabMode } = await import("@/lib/auth/ui-lab");
  const uiLab = isUiLabMode();
  if (uiLab) {
    return {
      canHalt: false,
      canActivate: false,
      canSweep: false,
      canContribute: false,
      canReconcile: false,
      canConfigureFees: false,
      canResolveIssues: false,
      canReopenIssues: false,
      operatorRole: "demonstration",
      isCorporateAdmin: true,
      uiLab: true,
    };
  }
  const actor = await requireTerminalOps();
  const { isCorporateAdmin } = await import("@/lib/auth/permissions");
  const corporate = isCorporateAdmin(actor);
  return {
    canHalt: true,
    canActivate: corporate,
    canSweep: corporate,
    canContribute: corporate,
    canReconcile: true,
    canConfigureFees: corporate,
    canResolveIssues: true,
    canReopenIssues: corporate,
    operatorRole: corporate ? "finance_senior" : "trading_market",
    isCorporateAdmin: corporate,
    uiLab: false,
  };
}

export const fetchCryptoOpsCapabilitiesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CryptoOpsActorCapabilities> => resolveCapabilities(),
);

export const fetchCryptoOpsDeskSummaryFn = createServerFn({ method: "GET" })
  .inputValidator((input?: { cryptoOpsScenario?: string }) => input ?? {})
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabCryptoOpsDeskSummary, parseUiLabCryptoOpsScenario } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-ops-fixtures"
      );
      return {
        ok: true as const,
        summary: getUiLabCryptoOpsDeskSummary(
          parseUiLabCryptoOpsScenario(data.cryptoOpsScenario),
        ),
        capabilities: await resolveCapabilities(),
      };
    }
    try {
      await requireTerminalOps();
      const { getCryptoOpsDeskSummary } = await import("./crypto-ops-read.service");
      return {
        ok: true as const,
        summary: await getCryptoOpsDeskSummary(),
        capabilities: await resolveCapabilities(),
      };
    } catch (error) {
      return toClientError(error);
    }
  });

export const fetchCryptoOpsAssetOverviewFn = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol: string; cryptoOpsScenario?: string }) => input)
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabCryptoOpsAssetWorkspace, parseUiLabCryptoOpsScenario } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-ops-fixtures"
      );
      const overview = getUiLabCryptoOpsAssetWorkspace(
        data.symbol,
        parseUiLabCryptoOpsScenario(data.cryptoOpsScenario),
      );
      if (!overview) {
        return {
          ok: false as const,
          code: "NOT_FOUND",
          message: cryptoOpsCustomerMessage("NOT_FOUND"),
        };
      }
      return { ok: true as const, overview, capabilities: await resolveCapabilities() };
    }
    await requireTerminalOps();
    try {
      const { getCryptoOpsAssetOverview } = await import("./crypto-ops-read.service");
      const overview = await getCryptoOpsAssetOverview(data.symbol);
      if (!overview) {
        return {
          ok: false as const,
          code: "NOT_FOUND",
          message: cryptoOpsCustomerMessage("NOT_FOUND"),
        };
      }
      return { ok: true as const, overview, capabilities: await resolveCapabilities() };
    } catch (error) {
      return toClientError(error);
    }
  });

export const fetchCryptoOpsAssetWorkspaceFn = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol: string; cryptoOpsScenario?: string }) => input)
  .handler(async ({ data }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabCryptoOpsAssetWorkspace, parseUiLabCryptoOpsScenario } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-ops-fixtures"
      );
      const workspace = getUiLabCryptoOpsAssetWorkspace(
        data.symbol,
        parseUiLabCryptoOpsScenario(data.cryptoOpsScenario),
      );
      if (!workspace) {
        return {
          ok: false as const,
          code: "NOT_FOUND",
          message: cryptoOpsCustomerMessage("NOT_FOUND"),
        };
      }
      return { ok: true as const, workspace, capabilities: await resolveCapabilities() };
    }
    try {
      await requireTerminalOps();
      const { getCryptoOpsAssetWorkspace } = await import("./crypto-ops-read.service");
      const workspace = await getCryptoOpsAssetWorkspace(data.symbol);
      if (!workspace) {
        return {
          ok: false as const,
          code: "NOT_FOUND",
          message: cryptoOpsCustomerMessage("NOT_FOUND"),
        };
      }
      return { ok: true as const, workspace, capabilities: await resolveCapabilities() };
    } catch (error) {
      return toClientError(error);
    }
  });

export const fetchCryptoActivationReadinessFn = createServerFn({ method: "GET" })
  .inputValidator((symbol: string) => symbol)
  .handler(async ({ data: symbol }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabCryptoActivationReadiness } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-ops-fixtures"
      );
      return { ok: true as const, readiness: getUiLabCryptoActivationReadiness(symbol) };
    }
    try {
      await requireTerminalOps();
      const { evaluateActivationReadiness } = await import(
        "./crypto-activation-readiness.service"
      );
      return { ok: true as const, readiness: await evaluateActivationReadiness(symbol) };
    } catch (error) {
      return toClientError(error);
    }
  });

export type TransitionCryptoStatusFnInput = {
  symbol: string;
  toStatus: TerminalCryptoAssetStatus;
  reason: string;
  confirmed: boolean;
  idempotencyKey: string;
  expectedStatus: TerminalCryptoAssetStatus;
  expectedVersion: number;
  typedSymbol?: string;
};

export const transitionCryptoAssetStatusFn = createServerFn({ method: "POST" })
  .inputValidator((input: TransitionCryptoStatusFnInput) => input)
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Terminal crypto lifecycle");

    const { resolveLifecycleTransition, transitionRequiresCorporateAdmin } = await import(
      "./crypto-lifecycle.service"
    );
    const transition = resolveLifecycleTransition(data.expectedStatus, data.toStatus);
    if (!transition) {
      return {
        ok: false as const,
        code: "INVALID_TRANSITION",
        message: cryptoOpsCustomerMessage("INVALID_TRANSITION"),
      };
    }

    const actor = transitionRequiresCorporateAdmin(transition)
      ? await requireCorporateOps()
      : await requireTerminalOps();

    try {
      const { transitionCryptoAssetStatus } = await import("./crypto-lifecycle.service");
      const result = await transitionCryptoAssetStatus(actor, data);
      return { ok: true as const, result };
    } catch (error) {
      return toClientError(error);
    }
  });

export const runCryptoReconciliationFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      reason: string;
      confirmed: boolean;
      idempotencyKey?: string;
      symbol?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Terminal crypto reconciliation");

    const actor = await requireTerminalOps();
    if (data.confirmed !== true) {
      return {
        ok: false as const,
        code: "CONFIRMATION_REQUIRED",
        message: cryptoOpsCustomerMessage("CONFIRMATION_REQUIRED"),
      };
    }
    if (typeof data.reason !== "string" || !data.reason.trim()) {
      return {
        ok: false as const,
        code: "VALIDATION_FAILED",
        message: "A nonempty operator reason is required.",
      };
    }
    try {
      const { runCryptoReconciliation } = await import("./crypto-reconciliation.service");
      const result = await runCryptoReconciliation({
        actorUserId: actor.id,
        source: "manual",
        assetSymbols: data.symbol ? [data.symbol] : undefined,
      });
      return { ok: true as const, result };
    } catch (error) {
      return toClientError(error);
    }
  });

export type SweepCryptoRevenueFnInput = {
  symbol: string;
  amount: string;
  reason: string;
  confirmed: boolean;
  idempotencyKey: string;
  expectedMarketStateVersion: number;
};

export const sweepCryptoRevenueFn = createServerFn({ method: "POST" })
  .inputValidator((input: SweepCryptoRevenueFnInput) => input)
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Terminal crypto revenue sweep");

    const actor = await requireCorporateOps();
    try {
      const { sweepCryptoRevenue } = await import("./crypto-revenue-sweep.service");
      const result = await sweepCryptoRevenue(actor, data);
      return { ok: true as const, result };
    } catch (error) {
      return toClientError(error);
    }
  });

export type RecordCryptoContributionFnInput = {
  symbol: string;
  kind: CryptoContributionKind;
  amount: string;
  reason: string;
  confirmed: boolean;
  idempotencyKey: string;
  expectedMarketStateVersion: number;
  externalReference?: string;
};

export const recordCryptoContributionFn = createServerFn({ method: "POST" })
  .inputValidator((input: RecordCryptoContributionFnInput) => input)
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Terminal crypto contribution");

    const actor = await requireCorporateOps();
    try {
      const { recordCryptoExternalContribution } = await import("./crypto-contribution.service");
      const result = await recordCryptoExternalContribution(actor, data);
      return { ok: true as const, result };
    } catch (error) {
      return toClientError(error);
    }
  });

export type UpdateCryptoFeeConfigFnInput = {
  symbol: string;
  totalFeeBps: number;
  revenueFeeBps: number;
  stabilizationFeeBps: number;
  reason: string;
  confirmed: boolean;
  idempotencyKey: string;
  expectedAssetVersion: number;
};

export const updateCryptoFeeConfigFn = createServerFn({ method: "POST" })
  .inputValidator((input: UpdateCryptoFeeConfigFnInput) => input)
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Terminal crypto fee configuration");

    const actor = await requireCorporateOps();
    try {
      const { updateCryptoFeeConfig } = await import("./crypto-config.service");
      const result = await updateCryptoFeeConfig(actor, {
        symbol: data.symbol,
        fees: {
          totalFeeBps: data.totalFeeBps,
          revenueFeeBps: data.revenueFeeBps,
          stabilizationFeeBps: data.stabilizationFeeBps,
        },
        reason: data.reason,
        confirmed: data.confirmed,
        idempotencyKey: data.idempotencyKey,
        expectedAssetVersion: data.expectedAssetVersion,
      });
      return { ok: true as const, result };
    } catch (error) {
      return toClientError(error);
    }
  });

export const fetchCryptoConfigSurfaceFn = createServerFn({ method: "GET" })
  .inputValidator((symbol: string) => symbol)
  .handler(async ({ data: symbol }) => {
    const { isUiLabMode } = await import("@/lib/auth/ui-lab");
    if (isUiLabMode()) {
      const { getUiLabCryptoConfigSurface } = await import(
        "@/lib/terminal/ui-lab/ui-lab-crypto-ops-fixtures"
      );
      const surface = getUiLabCryptoConfigSurface(symbol);
      if (!surface) {
        return {
          ok: false as const,
          code: "NOT_FOUND",
          message: cryptoOpsCustomerMessage("NOT_FOUND"),
        };
      }
      return { ok: true as const, surface, capabilities: await resolveCapabilities() };
    }
    try {
      await requireTerminalOps();
      const { getCryptoConfigSurface } = await import("./crypto-config.service");
      const surface = await getCryptoConfigSurface(symbol);
      if (!surface) {
        return {
          ok: false as const,
          code: "NOT_FOUND",
          message: cryptoOpsCustomerMessage("NOT_FOUND"),
        };
      }
      return { ok: true as const, surface, capabilities: await resolveCapabilities() };
    } catch (error) {
      return toClientError(error);
    }
  });

export type ResolveCryptoReconIssueFnInput = {
  issueId: string;
  reason: string;
  confirmed: boolean;
  idempotencyKey: string;
};

export const resolveCryptoReconIssueFn = createServerFn({ method: "POST" })
  .inputValidator((input: ResolveCryptoReconIssueFnInput) => input)
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Terminal crypto reconciliation issue resolve");

    const actor = await requireTerminalOps();
    try {
      const { resolveCryptoReconciliationIssue } = await import(
        "./crypto-reconciliation-issue.service"
      );
      const result = await resolveCryptoReconciliationIssue(actor, data);
      return { ok: true as const, result };
    } catch (error) {
      return toClientError(error);
    }
  });

export type ReopenCryptoReconIssueFnInput = {
  issueId: string;
  reason: string;
  confirmed: boolean;
  idempotencyKey: string;
};

export const reopenCryptoReconIssueFn = createServerFn({ method: "POST" })
  .inputValidator((input: ReopenCryptoReconIssueFnInput) => input)
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Terminal crypto reconciliation issue reopen");

    const actor = await requireCorporateOps();
    try {
      const { reopenCryptoReconciliationIssue } = await import(
        "./crypto-reconciliation-issue.service"
      );
      const result = await reopenCryptoReconciliationIssue(actor, data);
      return { ok: true as const, result };
    } catch (error) {
      return toClientError(error);
    }
  });
