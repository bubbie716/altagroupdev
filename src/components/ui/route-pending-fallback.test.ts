import { describe, expect, it } from "vitest";
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
    expect(skeletonName("/bank")).toBe("SkeletonBankDashboard");
    expect(skeletonName("/bank/")).toBe("SkeletonBankDashboard");
    expect(skeletonName("/bank/account/abc")).toBe("SkeletonAccountPage");
    expect(skeletonName("/bank/deposits")).toBe("SkeletonBankContentPage");
    expect(skeletonName("/bank/transfers/new")).toBe("SkeletonBankContentPage");
    expect(skeletonName("/bank/pay")).toBe("SkeletonBankContentPage");
  });

  it("maps internal, markets, legal, and ncc routes", () => {
    expect(skeletonName("/internal")).toBe("SkeletonInternalDashboard");
    expect(skeletonName("/internal/bank/transactions")).toBe("SkeletonInternalTablePage");
    expect(skeletonName("/terminal")).toBe("SkeletonMarketsDashboard");
    expect(skeletonName("/exchange/listings")).toBe("SkeletonMarketsDashboard");
    expect(skeletonName("/legal/privacy")).toBe("SkeletonLegalPage");
    expect(skeletonName("/admin")).toBe("SkeletonNccDashboard");
    expect(skeletonName("/dashboard")).toBe("SkeletonNccDashboard");
  });

  it("maps account and corporate surfaces", () => {
    expect(skeletonName("/profile")).toBe("SkeletonAccountSurface");
    expect(skeletonName("/companies")).toBe("SkeletonAccountSurface");
    expect(skeletonName("/support")).toBe("SkeletonCorporatePage");
  });
});
