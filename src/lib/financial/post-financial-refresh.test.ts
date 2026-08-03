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
}) {
  const calls = { invalidate: 0, clearCache: 0 };
  const router = {
    clearCache() {
      calls.clearCache += 1;
    },
    async invalidate() {
      calls.invalidate += 1;
      if (opts?.invalidateImpl) await opts.invalidateImpl();
    },
  };
  return { router, calls };
}

describe("post-financial-refresh compatibility aliases", () => {
  it("refreshFinancialRouteData delegates to shared soft refresh", async () => {
    const { router, calls } = mockRouter();
    const [a, b] = await Promise.all([
      refreshFinancialRouteData(router as never, "bank-terminal"),
      refreshFinancialRouteData(router as never, "bank-terminal"),
    ]);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(calls.invalidate, 1);
  });

  it("soft-fails without throwing when invalidate rejects", async () => {
    const { router } = mockRouter({
      invalidateImpl: async () => {
        throw new Error("network");
      },
    });
    const result = await refreshFinancialRouteData(router as never, "bank");
    assert.equal(result.ok, false);
    assert.equal(isRefreshFailureSoft(result), true);
  });

  it("exposes shared copy for refresh states", () => {
    assert.match(financialRefreshCopy("refreshing").visible ?? "", /Updating/);
    assert.match(financialRefreshCopy("updated").visible ?? "", /Updated/);
    assert.match(financialRefreshCopy("failed").visible ?? "", /may take a moment/i);
  });

  it("wires Terminal funding success to shared refresh without reload", () => {
    const flow = read("components/bank/actions/flows/terminal-funding-action-flow.tsx");
    assert.match(flow, /usePostFinancialRefresh/);
    assert.match(flow, /refreshAfterSuccess\("bank-terminal"\)/);
    assert.doesNotMatch(flow, /location\.reload|window\.location\.reload/);
  });

  it("covers representative money flows with shared refresh", () => {
    for (const rel of [
      "components/bank/actions/flows/deposit-action-flow.tsx",
      "components/bank/actions/flows/withdraw-action-flow.tsx",
      "components/bank/actions/flows/transfer-action-flow.tsx",
      "components/bank/actions/flows/pay-action-flow.tsx",
      "components/bank/loan-payment-form.tsx",
      "components/bank/alta-card/alta-card-payment-panel.tsx",
    ]) {
      const src = read(rel);
      assert.ok(
        /usePostFinancialRefresh|refreshAfterSuccess|refreshMutationRouteData|refreshFinancialRouteData/.test(
          src,
        ),
        `${rel} must refresh after success`,
      );
      assert.doesNotMatch(src, /window\.location\.reload\(/);
    }
  });

  it("treats failed refresh as soft", () => {
    const failed: PostFinancialRefreshResult = { ok: false, status: "failed" };
    assert.equal(isRefreshFailureSoft(failed), true);
  });
});
