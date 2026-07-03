import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveDiscordClientRoleId,
  resolveDiscordPrivateRoleId,
} from "@/server/discord-guild-role.service";

describe("discord guild role helpers", () => {
  it("resolves configured role ids from env", () => {
    const originalPrivate = process.env.DISCORD_PRIVATE_ROLE_ID;
    const originalClient = process.env.DISCORD_CLIENT_ROLE_ID;

    process.env.DISCORD_PRIVATE_ROLE_ID = "  private-role  ";
    process.env.DISCORD_CLIENT_ROLE_ID = "client-role";

    try {
      assert.equal(resolveDiscordPrivateRoleId(), "private-role");
      assert.equal(resolveDiscordClientRoleId(), "client-role");
    } finally {
      if (originalPrivate === undefined) {
        delete process.env.DISCORD_PRIVATE_ROLE_ID;
      } else {
        process.env.DISCORD_PRIVATE_ROLE_ID = originalPrivate;
      }
      if (originalClient === undefined) {
        delete process.env.DISCORD_CLIENT_ROLE_ID;
      } else {
        process.env.DISCORD_CLIENT_ROLE_ID = originalClient;
      }
    }
  });

  it("returns undefined when role ids are unset", () => {
    const originalPrivate = process.env.DISCORD_PRIVATE_ROLE_ID;
    const originalClient = process.env.DISCORD_CLIENT_ROLE_ID;

    delete process.env.DISCORD_PRIVATE_ROLE_ID;
    delete process.env.DISCORD_CLIENT_ROLE_ID;

    try {
      assert.equal(resolveDiscordPrivateRoleId(), undefined);
      assert.equal(resolveDiscordClientRoleId(), undefined);
    } finally {
      if (originalPrivate === undefined) {
        delete process.env.DISCORD_PRIVATE_ROLE_ID;
      } else {
        process.env.DISCORD_PRIVATE_ROLE_ID = originalPrivate;
      }
      if (originalClient === undefined) {
        delete process.env.DISCORD_CLIENT_ROLE_ID;
      } else {
        process.env.DISCORD_CLIENT_ROLE_ID = originalClient;
      }
    }
  });
});
