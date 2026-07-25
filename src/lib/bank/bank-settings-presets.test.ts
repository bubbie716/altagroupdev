import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_DISCORD_NOTIFICATION_TYPES,
  DISCORD_IMPORTANT_NOTIFICATION_TYPES,
  DISCORD_RECOMMENDED_NOTIFICATION_TYPES,
  allDiscordNotificationsOff,
  anyDiscordNotificationEnabled,
  applyDiscordNotificationPreset,
  detectDiscordNotificationPreset,
  discordGroupEnabledCount,
  enabledDiscordNotificationCount,
  normalizeDiscordNotificationPrefs,
  setDiscordGroupEnabled,
} from "./bank-settings-presets.ts";
import { BANK_DISCORD_NOTIFICATION_GROUPS } from "./bank-settings-types.ts";

describe("applyDiscordNotificationPreset", () => {
  it("writes an explicit boolean for every known notification type", () => {
    const prefs = applyDiscordNotificationPreset("important");
    for (const type of ALL_DISCORD_NOTIFICATION_TYPES) {
      assert.equal(typeof prefs[type], "boolean", `${type} should be explicit`);
    }
  });

  it("enables exactly the important set for the important preset", () => {
    const prefs = applyDiscordNotificationPreset("important");
    const enabled = ALL_DISCORD_NOTIFICATION_TYPES.filter((type) => prefs[type]);
    assert.deepEqual([...enabled].sort(), [...DISCORD_IMPORTANT_NOTIFICATION_TYPES].sort());
  });

  it("treats recommended as a superset of important", () => {
    const prefs = applyDiscordNotificationPreset("recommended");
    for (const type of DISCORD_IMPORTANT_NOTIFICATION_TYPES) {
      assert.equal(prefs[type], true, `${type} should stay on under recommended`);
    }
    assert.ok(
      enabledDiscordNotificationCount(prefs) >
        enabledDiscordNotificationCount(applyDiscordNotificationPreset("important")),
    );
  });

  it("enables every option for the all preset", () => {
    const prefs = applyDiscordNotificationPreset("all");
    assert.equal(
      enabledDiscordNotificationCount(prefs),
      ALL_DISCORD_NOTIFICATION_TYPES.length,
    );
  });

  it("leaves choices untouched for the custom preset", () => {
    const custom = { ...applyDiscordNotificationPreset("all"), TRANSFER_FAILED: false } as const;
    const prefs = applyDiscordNotificationPreset("custom", custom);
    assert.equal(prefs.TRANSFER_FAILED, false);
    assert.equal(prefs.TRANSFER_COMPLETED, true);
  });
});

describe("detectDiscordNotificationPreset", () => {
  it("round-trips every named preset", () => {
    for (const preset of ["important", "recommended", "all"] as const) {
      assert.equal(
        detectDiscordNotificationPreset(applyDiscordNotificationPreset(preset)),
        preset,
      );
    }
  });

  it("reads empty saved prefs as all, since absent values mean enabled", () => {
    assert.equal(detectDiscordNotificationPreset({}), "all");
  });

  it("falls back to custom for a one-off deviation", () => {
    const prefs = { ...applyDiscordNotificationPreset("recommended"), ALTA_PAY_SENT: false };
    assert.equal(detectDiscordNotificationPreset(prefs), "custom");
  });

  it("does not report a named preset when everything is off", () => {
    assert.equal(detectDiscordNotificationPreset(allDiscordNotificationsOff()), "custom");
  });
});

describe("allDiscordNotificationsOff", () => {
  it("disables every option explicitly so the master switch persists", () => {
    const prefs = allDiscordNotificationsOff();
    assert.equal(anyDiscordNotificationEnabled(prefs), false);
    for (const type of ALL_DISCORD_NOTIFICATION_TYPES) {
      assert.equal(prefs[type], false);
    }
  });
});

describe("normalizeDiscordNotificationPrefs", () => {
  it("promotes absent values to true and preserves explicit false", () => {
    const prefs = normalizeDiscordNotificationPrefs({ TRANSFER_FAILED: false });
    assert.equal(prefs.TRANSFER_FAILED, false);
    assert.equal(prefs.TRANSFER_COMPLETED, true);
  });
});

describe("setDiscordGroupEnabled", () => {
  const [firstGroup] = BANK_DISCORD_NOTIFICATION_GROUPS;

  it("clears only the targeted group", () => {
    const prefs = setDiscordGroupEnabled(
      applyDiscordNotificationPreset("all"),
      firstGroup.id,
      false,
    );
    const { enabled, total } = discordGroupEnabledCount(prefs, firstGroup.id);
    assert.equal(enabled, 0);
    assert.equal(total, firstGroup.options.length);
    assert.equal(
      enabledDiscordNotificationCount(prefs),
      ALL_DISCORD_NOTIFICATION_TYPES.length - total,
    );
  });

  it("selects all within the targeted group", () => {
    const prefs = setDiscordGroupEnabled(allDiscordNotificationsOff(), firstGroup.id, true);
    const { enabled, total } = discordGroupEnabledCount(prefs, firstGroup.id);
    assert.equal(enabled, total);
    assert.equal(enabledDiscordNotificationCount(prefs), total);
  });

  it("ignores an unknown group id", () => {
    const original = applyDiscordNotificationPreset("recommended");
    assert.equal(setDiscordGroupEnabled(original, "not-a-group", false), original);
  });
});

describe("preset definitions", () => {
  it("only references notification types that are rendered in a group", () => {
    const known = new Set(ALL_DISCORD_NOTIFICATION_TYPES);
    for (const type of DISCORD_RECOMMENDED_NOTIFICATION_TYPES) {
      assert.ok(known.has(type), `${type} is not present in any notification group`);
    }
  });

  it("has no duplicate entries", () => {
    assert.equal(
      new Set(DISCORD_RECOMMENDED_NOTIFICATION_TYPES).size,
      DISCORD_RECOMMENDED_NOTIFICATION_TYPES.length,
    );
  });
});
