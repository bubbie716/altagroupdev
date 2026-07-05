import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldBlockBotUserDuringMaintenance } from "@/server/bot-maintenance.service";

describe("bot maintenance gate", () => {
  it("allows interactions when maintenance is off", () => {
    assert.equal(shouldBlockBotUserDuringMaintenance(false, false), false);
    assert.equal(shouldBlockBotUserDuringMaintenance(false, true), false);
  });

  it("blocks non-bypass users when maintenance is on", () => {
    assert.equal(shouldBlockBotUserDuringMaintenance(true, false), true);
  });

  it("allows admin and operator bypass users during maintenance", () => {
    assert.equal(shouldBlockBotUserDuringMaintenance(true, true), false);
  });
});
