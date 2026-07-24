import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRouteSkeleton } from "@/components/ui/route-pending-fallback";

function skeletonName(pathname: string): string {
  const node = resolveRouteSkeleton(pathname);
  if (!node || typeof node !== "object" || !("type" in node)) return "unknown";
  const type = node.type;
  if (typeof type === "function") return type.name || "Anonymous";
  return "unknown";
}

describe("resolveRouteSkeleton", () => {
  it("maps bank routes to structural skeletons", () => {
    assert.equal(skeletonName("/bank"), "SkeletonBankDashboard");
    assert.equal(skeletonName("/bank/"), "SkeletonBankDashboard");
    assert.equal(skeletonName("/bank/account/abc"), "SkeletonAccountPage");
    assert.equal(skeletonName("/bank/deposits"), "SkeletonBankContentPage");
    assert.equal(skeletonName("/bank/transfers/new"), "SkeletonBankContentPage");
    assert.equal(skeletonName("/bank/pay"), "SkeletonBankContentPage");
  });

  it("maps internal, markets, legal, and shortcut routes", () => {
    assert.equal(skeletonName("/internal"), "SkeletonInternalDashboard");
    assert.equal(skeletonName("/internal/bank/transactions"), "SkeletonInternalTablePage");
    assert.equal(skeletonName("/terminal"), "SkeletonMarketsDashboard");
    assert.equal(skeletonName("/exchange/listings"), "SkeletonMarketsDashboard");
    assert.equal(skeletonName("/legal/privacy"), "SkeletonLegalPage");
    assert.equal(skeletonName("/admin"), "SkeletonShortcutDashboard");
    assert.equal(skeletonName("/dashboard"), "SkeletonShortcutDashboard");
  });

  it("maps account and corporate surfaces", () => {
    assert.equal(skeletonName("/profile"), "SkeletonAccountSurface");
    assert.equal(skeletonName("/companies"), "SkeletonAccountSurface");
    assert.equal(skeletonName("/support"), "SkeletonCorporatePage");
  });
});
