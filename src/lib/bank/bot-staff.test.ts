import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasDealRoomStaffDiscordRole,
} from "@/server/bot-staff.service";

describe("bot staff helpers", () => {
  it("detects deal room staff discord roles", () => {
    const original = process.env.DISCORD_DEAL_ROOM_STAFF_ROLE_IDS;
    process.env.DISCORD_DEAL_ROOM_STAFF_ROLE_IDS = "role-a,role-b";

    try {
      assert.equal(hasDealRoomStaffDiscordRole(["role-b", "other"]), true);
      assert.equal(hasDealRoomStaffDiscordRole(["other"]), false);
      assert.equal(hasDealRoomStaffDiscordRole([]), false);
    } finally {
      if (original === undefined) {
        delete process.env.DISCORD_DEAL_ROOM_STAFF_ROLE_IDS;
      } else {
        process.env.DISCORD_DEAL_ROOM_STAFF_ROLE_IDS = original;
      }
    }
  });
});
