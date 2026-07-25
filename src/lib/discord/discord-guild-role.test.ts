import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDiscordClientRoleId } from "@/server/discord-guild-role.service";

describe("discord guild role helpers", () => {
  it("resolves configured role ids from env", () => {
    const originalClient = process.env.DISCORD_CLIENT_ROLE_ID;

    process.env.DISCORD_CLIENT_ROLE_ID = "  client-role  ";

    try {
      assert.equal(resolveDiscordClientRoleId(), "client-role");
    } finally {
      if (originalClient === undefined) {
        delete process.env.DISCORD_CLIENT_ROLE_ID;
      } else {
        process.env.DISCORD_CLIENT_ROLE_ID = originalClient;
      }
    }
  });

  it("returns undefined when role ids are unset", () => {
    const originalClient = process.env.DISCORD_CLIENT_ROLE_ID;

    delete process.env.DISCORD_CLIENT_ROLE_ID;

    try {
      assert.equal(resolveDiscordClientRoleId(), undefined);
    } finally {
      if (originalClient === undefined) {
        delete process.env.DISCORD_CLIENT_ROLE_ID;
      } else {
        process.env.DISCORD_CLIENT_ROLE_ID = originalClient;
      }
    }
  });
});
