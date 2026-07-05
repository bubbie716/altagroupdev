import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEAL_ROOM_STAFF_MESSAGE_DM_COOLDOWN_MS,
  dealRoomStaffMessageDmCooldownCutoff,
  isStaffDealRoomMessageDmCooldownActive,
} from "@/lib/bank/deal-room-staff-message-dm-cooldown";

describe("deal room staff message DM cooldown", () => {
  it("uses a 10 minute cooldown window", () => {
    assert.equal(DEAL_ROOM_STAFF_MESSAGE_DM_COOLDOWN_MS, 10 * 60 * 1000);
  });

  it("treats timestamps inside the cooldown window as active", () => {
    const now = Date.parse("2026-07-05T15:00:00.000Z");
    const cutoff = dealRoomStaffMessageDmCooldownCutoff(now);
    const lastSentAt = new Date(now - 5 * 60 * 1000);

    assert.equal(isStaffDealRoomMessageDmCooldownActive(lastSentAt, cutoff), true);
  });

  it("allows another DM after the cooldown window expires", () => {
    const now = Date.parse("2026-07-05T15:00:00.000Z");
    const cutoff = dealRoomStaffMessageDmCooldownCutoff(now);
    const lastSentAt = new Date(now - 11 * 60 * 1000);

    assert.equal(isStaffDealRoomMessageDmCooldownActive(lastSentAt, cutoff), false);
    assert.equal(isStaffDealRoomMessageDmCooldownActive(null, cutoff), false);
  });
});
