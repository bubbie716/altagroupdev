import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  isRefreshFailureSoft,
  matchPathname,
  mutationRefreshCopy,
  refreshMutationRouteData,
  scopePrefixes,
  shouldClearCachedMatch,
  type PostMutationRefreshResult,
} from "@/lib/router/post-mutation-refresh";

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
    lastClearFilter: null as null | ((match: { pathname?: string; routeId?: string }) => boolean),
  };
  const router = {
    clearCache(args: { filter?: (match: { pathname?: string; routeId?: string }) => boolean }) {
      calls.clearCache += 1;
      calls.lastClearFilter = args.filter ?? null;
      opts?.clearCacheImpl?.(args);
    },
    async invalidate(args?: { filter?: (match: { routeId?: string }) => boolean }) {
      calls.invalidate += 1;
      // Mimic invalidateRouteData: callers pass a non-root filter.
      if (args?.filter) {
        assert.equal(args.filter({ routeId: "__root__" }), false);
        assert.equal(args.filter({ routeId: "/bank/" }), true);
      }
      if (opts?.invalidateImpl) await opts.invalidateImpl();
    },
  };
  return { router, calls };
}

describe("post-mutation-refresh scopes", () => {
  it("maps scopes to the expected route prefixes", () => {
    assert.deepEqual(scopePrefixes("bank"), ["/bank", "/internal/bank", "/internal/inbox"]);
    assert.deepEqual(scopePrefixes("terminal"), ["/terminal", "/internal/terminal"]);
    assert.ok(scopePrefixes("corporate").includes("/companies"));
    assert.ok(scopePrefixes("corporate").includes("/bank"));
    assert.ok(scopePrefixes("internal").includes("/internal"));
    assert.ok(scopePrefixes("bank-terminal").includes("/bank"));
    assert.ok(scopePrefixes("bank-terminal").includes("/terminal"));
    assert.ok(scopePrefixes("lending").includes("/bank/lending"));
    assert.ok(scopePrefixes("alta-card").includes("/bank/alta-card"));
    assert.ok(scopePrefixes("all").includes("/onboarding"));
  });

  it("never clears the root auth/maintenance match", () => {
    const prefixes = scopePrefixes("all");
    assert.equal(
      shouldClearCachedMatch({ routeId: "__root__", pathname: "/" }, prefixes),
      false,
    );
    assert.equal(
      shouldClearCachedMatch({ routeId: "/bank/", pathname: "/bank" }, prefixes),
      true,
    );
  });

  it("matchPathname respects prefix boundaries", () => {
    assert.equal(matchPathname("/bank", ["/bank"]), true);
    assert.equal(matchPathname("/bank/lending", ["/bank"]), true);
    assert.equal(matchPathname("/banking", ["/bank"]), false);
    assert.equal(matchPathname(undefined, ["/bank"]), false);
  });
});

describe("post-mutation-refresh runtime", () => {
  it("deduplicates concurrent refreshes for the same scope", async () => {
    const { router, calls } = mockRouter();
    const [a, b] = await Promise.all([
      refreshMutationRouteData(router as never, "bank-terminal"),
      refreshMutationRouteData(router as never, "bank-terminal"),
    ]);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(calls.invalidate, 1);
    assert.equal(calls.clearCache, 1);
  });

  it("soft-fails without throwing when invalidate rejects", async () => {
    const { router } = mockRouter({
      invalidateImpl: async () => {
        throw new Error("network");
      },
    });
    const result = await refreshMutationRouteData(router as never, "bank");
    assert.equal(result.ok, false);
    assert.equal(result.status, "failed");
    assert.equal(isRefreshFailureSoft(result), true);
  });

  it("clearCache filter excludes root and respects scope prefixes", async () => {
    const { router, calls } = mockRouter();
    await refreshMutationRouteData(router as never, "terminal");
    assert.ok(calls.lastClearFilter);
    assert.equal(calls.lastClearFilter!({ routeId: "__root__", pathname: "/" }), false);
    assert.equal(
      calls.lastClearFilter!({ routeId: "/terminal/", pathname: "/terminal/orders" }),
      true,
    );
    assert.equal(
      calls.lastClearFilter!({ routeId: "/bank/", pathname: "/bank" }),
      false,
    );
  });
});

describe("mutation refresh copy", () => {
  it("uses Updating… / soft-fail completed language", () => {
    assert.equal(mutationRefreshCopy("refreshing").visible, "Updating…");
    assert.equal(mutationRefreshCopy("updated").visible, "Updated.");
    assert.match(
      mutationRefreshCopy("failed").visible ?? "",
      /action completed.*may take a moment/i,
    );
    assert.doesNotMatch(mutationRefreshCopy("failed").live, /failed|error/i);
  });
});

describe("post-mutation-refresh integration surface", () => {
  const moneyFlows = [
    ["deposit", "components/bank/actions/flows/deposit-action-flow.tsx", "bank"],
    ["withdraw", "components/bank/actions/flows/withdraw-action-flow.tsx", "bank"],
    ["transfer", "components/bank/actions/flows/transfer-action-flow.tsx", "bank"],
    ["pay", "components/bank/actions/flows/pay-action-flow.tsx", "bank"],
    ["funding", "components/bank/actions/flows/terminal-funding-action-flow.tsx", "bank-terminal"],
    ["loan", "components/bank/loan-payment-form.tsx", "lending"],
    ["card", "components/bank/alta-card/alta-card-payment-panel.tsx", "alta-card"],
  ] as const;

  for (const [name, rel, scope] of moneyFlows) {
    it(`${name} refreshes after success with scope ${scope}`, () => {
      const src = read(rel);
      assert.match(src, new RegExp(`refreshAfterSuccess\\("${scope}"\\)`));
      assert.doesNotMatch(src, /window\.location\.reload\(|location\.reload\(/);
    });
  }

  it("terminal crypto/order surfaces use shared refresh without hard reload", () => {
    const security = read("routes/terminal/security/$symbol.tsx");
    const orders = read("routes/terminal/orders.tsx");
    const scheduled = read("routes/terminal/orders/scheduled.$instructionId.tsx");
    for (const src of [security, orders, scheduled]) {
      assert.match(src, /refreshMutationRouteData\(router, "terminal"\)/);
      assert.doesNotMatch(src, /window\.location\.reload\(/);
      assert.doesNotMatch(src, /invalidateRouteData\(/);
    }
  });

  it("OpsAction uses soft internal refresh after confirm", () => {
    const src = read("components/internal/ops-action.tsx");
    assert.match(src, /refreshMutationRouteData\(router, "internal"\)/);
  });

  it("inbox OpsAction path does not double-invalidate", () => {
    const src = read("components/internal/inbox/inbox-case-actions.tsx");
    assert.doesNotMatch(src, /router\.invalidate\(/);
    assert.doesNotMatch(src, /refreshMutationRouteData/);
  });

  it("keeps success receipt mounted while refreshing in funding flow", () => {
    const flow = read("components/bank/actions/flows/terminal-funding-action-flow.tsx");
    const processUi = read("components/bank/actions/bank-process-ui.tsx");
    assert.match(flow, /step === "success"/);
    assert.match(flow, /BankActionSuccess/);
    assert.match(flow, /refreshStatus/);
    assert.match(flow, /Retry refresh|onRetryRefresh/);
    assert.match(processUi, /mutationRefreshCopy/);
    assert.match(processUi, /Retry refresh/);
    assert.match(read("lib/router/post-mutation-refresh.ts"), /Updating…/);
  });

  it("failed mutations do not call refresh in terminal funding", () => {
    const flow = read("components/bank/actions/flows/terminal-funding-action-flow.tsx");
    assert.match(flow, /setStep\("success"\)[\s\S]*refreshAfterSuccess/);
    assert.doesNotMatch(
      flow,
      /setStep\("error"\)[\s\S]{0,80}refreshAfterSuccess/,
    );
  });

  it("UI Lab mutation gates remain intact in funding flow", () => {
    const flow = read("components/bank/actions/flows/terminal-funding-action-flow.tsx");
    assert.match(flow, /getBankActionUiLabScenario/);
    assert.match(flow, /uiLabScenario/);
  });

  it("product consent mid-flow still avoids invalidate", () => {
    const src = read("components/legal/product-consent-action-controller.tsx");
    assert.match(src, /Do not router\.invalidate\(\) here mid-sequence/);
  });

  it("shared refresh path has no hard reload", () => {
    const refresh = read("lib/router/post-mutation-refresh.ts");
    const hook = read("hooks/use-post-mutation-refresh.ts");
    assert.doesNotMatch(refresh, /location\.reload/);
    assert.doesNotMatch(hook, /location\.reload/);
    assert.match(refresh, /invalidateRouteData/);
    assert.match(refresh, /clearCache/);
  });

  it("mutation money flows do not hard-reload", () => {
    const files = [
      "components/bank/actions/flows/deposit-action-flow.tsx",
      "components/bank/actions/flows/transfer-action-flow.tsx",
      "components/bank/actions/flows/pay-action-flow.tsx",
      "components/bank/alta-card/alta-card-payment-panel.tsx",
      "components/bank/loan-payment-form.tsx",
      "components/bank/actions/flows/terminal-funding-action-flow.tsx",
      "routes/terminal/security/$symbol.tsx",
      "components/internal/ops-action.tsx",
    ];
    for (const rel of files) {
      assert.doesNotMatch(read(rel), /window\.location\.reload\(|location\.reload\(/);
    }
  });

  it("BalanceValue and MoneyValue preserve reduced-motion behavior", () => {
    const balance = read("components/financial/balance-value.tsx");
    const money = read("components/terminal/money-value.tsx");
    assert.match(balance, /prefers-reduced-motion/);
    assert.match(balance, /prev === value/);
    assert.match(money, /animateOnChange/);
    assert.match(money, /prefers-reduced-motion/);
  });

  it("financial alias layer re-exports shared refresh", () => {
    const alias = read("lib/financial/post-financial-refresh.ts");
    assert.match(alias, /post-mutation-refresh/);
    assert.match(alias, /refreshMutationRouteData as refreshFinancialRouteData/);
  });
});

describe("post-mutation-refresh result typing", () => {
  it("treats failed refresh as soft", () => {
    const failed: PostMutationRefreshResult = { ok: false, status: "failed" };
    assert.equal(isRefreshFailureSoft(failed), true);
    const ok: PostMutationRefreshResult = { ok: true, status: "updated" };
    assert.equal(isRefreshFailureSoft(ok), false);
  });
});
