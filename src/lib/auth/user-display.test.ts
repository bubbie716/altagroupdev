import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAltaUserDisplayName,
  formatAltaUserHandle,
  formatAltaUserInitials,
  formatDiscordUsername,
} from "@/lib/auth/user-display";

describe("user display identity", () => {
  it("prefers Minecraft username for display and handle", () => {
    const user = { minecraftUsername: "Steve", discordUsername: "steve.discord" };
    assert.equal(formatAltaUserDisplayName(user), "Steve");
    assert.equal(formatAltaUserHandle(user), "Steve");
    assert.equal(formatDiscordUsername(user), "steve.discord");
  });

  it("falls back to Discord when Minecraft is missing", () => {
    const user = { minecraftUsername: null, discordUsername: "carter.townshend" };
    assert.equal(formatAltaUserDisplayName(user), "Carter Townshend");
    assert.equal(formatAltaUserHandle(user), "carter.townshend");
  });

  it("builds initials from the preferred display name", () => {
    assert.equal(formatAltaUserInitials({ minecraftUsername: "Steve", discordUsername: "x" }), "ST");
    assert.equal(
      formatAltaUserInitials({ minecraftUsername: null, discordUsername: "ada.lovelace" }),
      "AL",
    );
  });
});
