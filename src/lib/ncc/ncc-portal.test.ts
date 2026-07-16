import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PORTAL_NAV } from "@/lib/ncc/portal-types";
import {
  formatDurationMs,
  formatPortalMoney,
} from "@/components/ncc/portal/portal-status-badge";

describe("ncc portal", () => {
  it("exposes the institution sidebar navigation order", () => {
    assert.deepEqual(
      PORTAL_NAV.map((item) => item.to),
      [
        "/portal",
        "/portal/queue",
        "/portal/settlements",
        "/portal/accounts",
        "/portal/routing",
        "/portal/members",
        "/portal/reports",
        "/portal/audit",
        "/portal/developers",
        "/portal/settings",
        "/portal/support",
      ],
    );
  });

  it("formats money and duration for dense operational UI", () => {
    assert.equal(formatPortalMoney(1250.5, "FLR"), "ƒ 1,250.50");
    assert.equal(formatDurationMs(null), "—");
    assert.equal(formatDurationMs(450), "450 ms");
    assert.equal(formatDurationMs(2500), "2.5 s");
  });
});
