import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canRespondToAltaPrivateInvitation,
  canRevokeAltaPrivateInvitation,
  canSendAltaPrivateInvitation,
  goldCardEligibleForUser,
} from "./alta-private-invitation-rules.ts";
import { isAltaPrivateDiscordConfigured } from "../../server/alta-private-discord.service.ts";

describe("alta private invitation rules", () => {
  it("allows send when customer is not a member and has no pending invite", () => {
    assert.deepEqual(
      canSendAltaPrivateInvitation({ membershipActive: false, hasPendingInvitation: false }),
      { ok: true },
    );
  });

  it("blocks send when membership is already active", () => {
    const result = canSendAltaPrivateInvitation({ membershipActive: true, hasPendingInvitation: false });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "already_member");
  });

  it("blocks send when a pending invitation exists", () => {
    const result = canSendAltaPrivateInvitation({ membershipActive: false, hasPendingInvitation: true });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "pending_exists");
  });

  it("allows only the invited user to accept a pending invitation", () => {
    assert.deepEqual(
      canRespondToAltaPrivateInvitation({
        invitationUserId: "user-a",
        actorUserId: "user-a",
        status: "pending",
        expiresAt: null,
      }),
      { ok: true },
    );
    assert.deepEqual(
      canRespondToAltaPrivateInvitation({
        invitationUserId: "user-a",
        actorUserId: "user-b",
        status: "pending",
        expiresAt: null,
      }),
      { ok: false, reason: "wrong_user" },
    );
  });

  it("blocks acceptance for expired invitations", () => {
    const result = canRespondToAltaPrivateInvitation({
      invitationUserId: "user-a",
      actorUserId: "user-a",
      status: "pending",
      expiresAt: "2020-01-01T00:00:00.000Z",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    assert.deepEqual(result, { ok: false, reason: "expired" });
  });

  it("blocks acceptance for revoked invitations", () => {
    const result = canRespondToAltaPrivateInvitation({
      invitationUserId: "user-a",
      actorUserId: "user-a",
      status: "revoked",
      expiresAt: null,
    });
    assert.deepEqual(result, { ok: false, reason: "not_pending" });
  });

  it("allows revoke only for pending invitations", () => {
    assert.equal(canRevokeAltaPrivateInvitation("pending"), true);
    assert.equal(canRevokeAltaPrivateInvitation("accepted"), false);
  });

  it("restricts Gold Card eligibility to Alta Private members", () => {
    assert.equal(goldCardEligibleForUser(true), true);
    assert.equal(goldCardEligibleForUser(false), false);
  });

  it("does not require Discord env vars for core flow", () => {
    assert.equal(isAltaPrivateDiscordConfigured(), false);
  });
});
