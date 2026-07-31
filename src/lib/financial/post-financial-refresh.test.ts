import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  financialRefreshCopy,
  isRefreshFailureSoft,
  refreshFinancialRouteData,
  type PostFinancialRefreshResult,
} from "@/lib/financial/post-financial-refresh";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function mockRouter(opts?: {
  invalidateImpl?: () => Promise<void>;
  clearCacheImpl?: (args: unknown) => void;
}) {
  const calls = {
    invalidate: 0,
    clearCache: 0,
  };
  const router = {
    clearCache(args: unknown) {
      calls.clearCache += 1;
      opts?.clearCacheImpl?.(args);
    },
    async invalidate() {
      calls.invalidate += 1;
      if (opts?.invalidateImpl) await opts.invalidateImpl();
    },
  };
  return { router, calls };
}

describe("post-financial-refresh", () => {
  it("refreshes exactly once when concurrent calls share a scope", async () => {
    const { router, calls } = mockRouter();
    const [a, b] = await Promise.all([
      refreshFinancialRouteData(router as never, "bank-terminal"),
      refreshFinancialRouteData(router as never, "bank-terminal"),
    ]);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(calls.invalidate, 1);
    assert.equal(calls.clearCache, 1);
  });

  it("soft-fails without throwing when invalidate rejects", async () => {
    const { router, calls } = mockRouter({
      invalidateImpl: async () => {
        throw new Error("network");
      },
    });
    const result = await refreshFinancialRouteData(router as never, "bank");
    assert.equal(result.ok, false);
    assert.equal(result.status, "failed");
    assert.equal(isRefreshFailureSoft(result), true);
    assert.equal(calls.invalidate, 1);
  });

  it("exposes restrained copy for refresh states", () => {
    assert.match(financialRefreshCopy("refreshing").visible ?? "", /Updating balances/);
    assert.match(financialRefreshCopy("updated").visible ?? "", /Balances updated/);
    assert.match(
      financialRefreshCopy("failed").visible ?? "",
      /may take a moment/i,
    );
  });

  it("wires Terminal funding success to shared refresh without reload", () => {
    const flow = read("components/bank/actions/flows/terminal-funding-action-flow.tsx");
    assert.match(flow, /usePostFinancialRefresh/);
    assert.match(flow, /refreshAfterSuccess\("bank-terminal"\)/);
    assert.match(flow, /refreshStatus/);
    assert.match(flow, /Retry refresh|onRetryRefresh/);
    assert.doesNotMatch(flow, /location\.reload|window\.location\.reload/);
  });

  it("keeps success receipt mounted while refreshing", () => {
    const flow = read("components/bank/actions/flows/terminal-funding-action-flow.tsx");
    const chrome = read("components/bank/actions/bank-action-chrome.tsx");
    const processUi = read("components/bank/actions/bank-process-ui.tsx");
    assert.match(flow, /step === "success"/);
    assert.match(flow, /BankActionSuccess/);
    assert.match(chrome, /refreshStatus/);
    assert.match(processUi, /Updating balances/);
    assert.match(processUi, /Retry refresh/);
  });

  it("does not use hard reload in the shared refresh path", () => {
    const refresh = read("lib/financial/post-financial-refresh.ts");
    const hook = read("hooks/use-post-financial-refresh.ts");
    assert.doesNotMatch(refresh, /location\.reload/);
    assert.doesNotMatch(hook, /location\.reload/);
    assert.match(refresh, /invalidateRouteData/);
    assert.match(refresh, /clearCache/);
  });

  it("BalanceValue respects reduced motion and only highlights changes", () => {
    const src = read("components/financial/balance-value.tsx");
    assert.match(src, /prefers-reduced-motion/);
    assert.match(src, /prev === value/);
    assert.match(src, /durationMs = 400/);
  });

  it("MoneyValue animateOnChange respects reduced motion", () => {
    const src = read("components/terminal/money-value.tsx");
    assert.match(src, /animateOnChange/);
    assert.match(src, /prefers-reduced-motion/);
    assert.match(src, /prev === value/);
  });

  it("failed mutations do not call refresh in terminal funding", () => {
    const flow = read("components/bank/actions/flows/terminal-funding-action-flow.tsx");
    // refresh only after success assignment
    assert.match(flow, /setStep\("success"\)[\s\S]*refreshAfterSuccess/);
    assert.doesNotMatch(
      flow,
      /setStep\("error"\)[\s\S]{0,80}refreshAfterSuccess/,
    );
  });

  it("OpsAction uses soft financial refresh after confirm", () => {
    const src = read("components/internal/ops-action.tsx");
    assert.match(src, /refreshFinancialRouteData/);
    assert.doesNotMatch(src, /invalidateRouteData/);
  });

  it("UI Lab mutation gates remain intact in funding flow", () => {
    const flow = read("components/bank/actions/flows/terminal-funding-action-flow.tsx");
    assert.match(flow, /getBankActionUiLabScenario/);
    assert.match(flow, /uiLabScenario/);
  });
});

describe("post-financial-refresh integration surface", () => {
  it("covers representative money flows with shared refresh or invalidateRouteData", () => {
    const deposit = read("components/bank/actions/flows/deposit-action-flow.tsx");
    const withdraw = read("components/bank/actions/flows/withdraw-action-flow.tsx");
    const transfer = read("components/bank/actions/flows/transfer-action-flow.tsx");
    const pay = read("components/bank/actions/flows/pay-action-flow.tsx");
    const loan = read("components/bank/loan-payment-form.tsx");
    const card = read("components/bank/alta-card/alta-card-payment-panel.tsx");

    for (const [name, src] of [
      ["deposit", deposit],
      ["withdraw", withdraw],
      ["transfer", transfer],
      ["pay", pay],
      ["loan", loan],
      ["card", card],
    ] as const) {
      assert.ok(
        /usePostFinancialRefresh|refreshAfterSuccess|invalidateRouteData|router\.invalidate/.test(
          src,
        ),
        `${name} must refresh after success`,
      );
      assert.doesNotMatch(src, /window\.location\.reload\(/);
    }
  });
});

describe("post-financial-refresh result typing", () => {
  it("treats failed refresh as soft", () => {
    const failed: PostFinancialRefreshResult = { ok: false, status: "failed" };
    assert.equal(isRefreshFailureSoft(failed), true);
    const ok: PostFinancialRefreshResult = { ok: true, status: "updated" };
    assert.equal(isRefreshFailureSoft(ok), false);
  });
});
