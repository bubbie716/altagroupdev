import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAltaPrivateClientContext,
  formatMemberSinceLabel,
  formatPrivateClientDisplayName,
  formatTimeOfDayGreeting,
  formatWelcomeBackGreeting,
} from "./alta-private-client-experience.ts";

describe("alta private client experience", () => {
  it("formats a friendly display name from Discord username", () => {
    assert.equal(formatPrivateClientDisplayName("carter_townshend"), "Carter");
    assert.equal(formatPrivateClientDisplayName("FTLCEO#1234"), "FTLCEO");
  });

  it("builds time-of-day and welcome-back greetings", () => {
    const morning = new Date("2026-06-15T09:00:00");
    assert.equal(formatTimeOfDayGreeting("Carter", morning), "Good morning, Carter.");
    assert.equal(formatWelcomeBackGreeting("Carter"), "Welcome back, Carter.");
  });

  it("formats member since as month and year", () => {
    assert.equal(formatMemberSinceLabel("2026-06-15T12:00:00.000Z"), "June 2026");
  });

  it("returns empty context for non-members", () => {
    const ctx = buildAltaPrivateClientContext({
      isMember: false,
      discordUsername: "guest",
      memberSince: null,
    });
    assert.equal(ctx.isMember, false);
    assert.equal(ctx.banker, null);
    assert.equal(ctx.benefits.length, 0);
  });

  it("includes banker and benefits for active members", () => {
    const ctx = buildAltaPrivateClientContext({
      isMember: true,
      discordUsername: "carter",
      memberSince: "2026-06-01T00:00:00.000Z",
    });
    assert.equal(ctx.isMember, true);
    assert.ok(ctx.banker?.name);
    assert.ok(ctx.benefits.length > 0);
  });
});
