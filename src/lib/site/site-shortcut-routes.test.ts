import { describe, expect, it } from "vitest";
import {
  isSiteShortcutPath,
  resolveLegacyDashboardPath,
  resolveLegacyMarketsPath,
} from "@/lib/site/site-shortcut-routes";

describe("site-shortcut-routes", () => {
  it("recognizes shortcut paths", () => {
    expect(isSiteShortcutPath("/dashboard")).toBe(true);
    expect(isSiteShortcutPath("/login")).toBe(true);
    expect(isSiteShortcutPath("/bank")).toBe(false);
  });

  it("maps dashboard shortcuts per site", () => {
    expect(resolveLegacyDashboardPath("corporate")).toBe("/home");
    expect(resolveLegacyDashboardPath("bank")).toBe("/bank");
    expect(resolveLegacyDashboardPath("exchange")).toBe("/exchange");
    expect(resolveLegacyDashboardPath("terminal")).toBe("/terminal");
    expect(resolveLegacyDashboardPath("ncc")).toBe("/dashboard");
  });

  it("maps markets shortcuts per site", () => {
    expect(resolveLegacyMarketsPath("terminal")).toBe("/terminal");
    expect(resolveLegacyMarketsPath("exchange")).toBe("/exchange");
    expect(resolveLegacyMarketsPath("bank")).toBe("/exchange");
  });
});
