import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addUtcMonths,
  buildOccurrenceIdempotencyKey,
  calculateResumeNextRunAt,
  computeNextRunAt,
  isPastEndDate,
  normalizeStartAtMustBeFuture,
} from "@/lib/terminal/scheduled-trade-schedule";

describe("scheduled-trade-schedule", () => {
  it("addUtcMonths clamps Jan 31 to Feb last day", () => {
    const jan31 = new Date(Date.UTC(2026, 0, 31, 14, 30, 0));
    const feb = addUtcMonths(jan31, 1);
    assert.equal(feb.getUTCMonth(), 1);
    assert.equal(feb.getUTCDate(), 28);
    assert.equal(feb.getUTCHours(), 14);
  });

  it("computeNextRunAt advances weekly and biweekly", () => {
    const base = new Date(Date.UTC(2026, 6, 1, 14, 30, 0));
    const weekly = computeNextRunAt(base, "WEEKLY");
    assert.equal(weekly.getTime() - base.getTime(), 7 * 86_400_000);
    const biweekly = computeNextRunAt(base, "BIWEEKLY");
    assert.equal(biweekly.getTime() - base.getTime(), 14 * 86_400_000);
  });

  it("computeNextRunAt advances monthly with clamp", () => {
    const base = new Date(Date.UTC(2026, 0, 31, 9, 0, 0));
    const next = computeNextRunAt(base, "MONTHLY");
    assert.equal(next.getUTCMonth(), 1);
    assert.equal(next.getUTCDate(), 28);
  });

  it("normalizeStartAtMustBeFuture rejects past starts", () => {
    const now = new Date(Date.UTC(2026, 6, 1, 12, 0, 0));
    const future = new Date(Date.UTC(2026, 6, 2, 12, 0, 0));
    assert.doesNotThrow(() => normalizeStartAtMustBeFuture(future, now));
    assert.throws(() => normalizeStartAtMustBeFuture(now, now));
  });

  it("calculateResumeNextRunAt skips missed recurring runs", () => {
    const now = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
    const startAt = new Date(Date.UTC(2026, 5, 1, 14, 30, 0));
    const next = calculateResumeNextRunAt(
      {
        scheduleType: "RECURRING",
        startAt,
        nextRunAt: new Date(Date.UTC(2026, 6, 1, 14, 30, 0)),
        endAt: null,
        frequency: "WEEKLY",
      },
      now,
    );
    assert.ok(next);
    assert.ok(next!.getTime() > now.getTime());
  });

  it("isPastEndDate respects end boundary", () => {
    const endAt = new Date(Date.UTC(2026, 11, 31, 23, 59, 0));
    assert.equal(isPastEndDate(endAt, new Date(Date.UTC(2027, 0, 1, 0, 0, 0))), true);
    assert.equal(isPastEndDate(endAt, new Date(Date.UTC(2026, 11, 30, 0, 0, 0))), false);
    assert.equal(isPastEndDate(null, new Date()), false);
  });

  it("buildOccurrenceIdempotencyKey uses stable prefix", () => {
    assert.equal(
      buildOccurrenceIdempotencyKey("occ_123"),
      "scheduled-trade-occurrence:occ_123",
    );
  });
});
