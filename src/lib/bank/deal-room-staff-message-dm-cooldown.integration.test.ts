/**
 * Integration tests for deal room staff-message DM cooldown.
 * Requires DATABASE_URL and migration 20250703380000_deal_room_staff_dm_cooldown.
 *
 *   npx tsx --test src/lib/bank/deal-room-staff-message-dm-cooldown.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, describe, it } from "node:test";
import type { SecureDealRoomType } from "@prisma/client";
import {
  DEAL_ROOM_STAFF_MESSAGE_DM_COOLDOWN_MS,
  recordStaffDealRoomMessageDmSent,
  shouldSendStaffDealRoomMessageDm,
} from "@/lib/bank/deal-room-staff-message-dm-cooldown";
import { prisma } from "@/server/db";
import { notifyStaffDealRoomMessageBestEffort } from "@/server/secure-deal-room-discord.service";

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function uniqueId(prefix: string): string {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}

type TestFixture = {
  applicantUserId: string;
  staffUserId: string;
  dealRoomType: SecureDealRoomType;
  dealRoomId: string;
  threadId: string;
  sessionId: string;
};

const createdUserIds = new Set<string>();
const createdSessionIds = new Set<string>();
const createdNotificationIds = new Set<string>();

async function createTestUser(label: string) {
  const user = await prisma.user.create({
    data: {
      discordId: uniqueId(`dm-cooldown-${label}`),
      discordUsername: `cooldown-${label}`,
    },
  });
  createdUserIds.add(user.id);
  return user;
}

async function createFixture(): Promise<TestFixture> {
  const applicant = await createTestUser("applicant");
  const staff = await createTestUser("staff");
  const dealRoomId = uniqueId("app");
  const threadId = uniqueId("thread");
  const dealRoomType: SecureDealRoomType = "ALTA_CARD_APPLICATION";

  const session = await prisma.secureDealRoomDiscordSession.create({
    data: {
      dealRoomType,
      dealRoomId,
      threadId,
      userId: applicant.id,
      discordUserId: applicant.discordId,
      status: "ACTIVE",
    },
  });
  createdSessionIds.add(session.id);

  return {
    applicantUserId: applicant.id,
    staffUserId: staff.id,
    dealRoomType,
    dealRoomId,
    threadId,
    sessionId: session.id,
  };
}

async function cleanupFixtures(): Promise<void> {
  if (createdNotificationIds.size > 0) {
    await prisma.userNotification.deleteMany({
      where: { id: { in: [...createdNotificationIds] } },
    });
  }
  if (createdSessionIds.size > 0) {
    await prisma.secureDealRoomDiscordSession.deleteMany({
      where: { id: { in: [...createdSessionIds] } },
    });
  }
  if (createdUserIds.size > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: [...createdUserIds] } },
    });
  }
}

function cooldownInput(fixture: TestFixture) {
  return {
    dealRoomType: fixture.dealRoomType,
    dealRoomId: fixture.dealRoomId,
    applicantUserId: fixture.applicantUserId,
  };
}

function notifyInput(
  fixture: TestFixture,
  messageId: string,
  messageBody: string,
) {
  return {
    dealRoomType: fixture.dealRoomType,
    dealRoomId: fixture.dealRoomId,
    threadId: fixture.threadId,
    applicantUserId: fixture.applicantUserId,
    staffUserId: fixture.staffUserId,
    staffDisplayName: "Staff Tester",
    messageId,
    messageBody,
  };
}

describe("deal room staff message DM cooldown (integration)", { skip: !hasDatabaseUrl() }, () => {
  after(async () => {
    await cleanupFixtures();
  });

  it("allows the first staff-message DM when no cooldown is recorded", async () => {
    const fixture = await createFixture();

    const allowed = await shouldSendStaffDealRoomMessageDm(cooldownInput(fixture));
    assert.equal(allowed, true);
  });

  it("blocks another DM within 10 minutes after recordStaffDealRoomMessageDmSent", async () => {
    const fixture = await createFixture();

    await recordStaffDealRoomMessageDmSent({
      dealRoomType: fixture.dealRoomType,
      dealRoomId: fixture.dealRoomId,
    });

    const blocked = await shouldSendStaffDealRoomMessageDm(cooldownInput(fixture));
    assert.equal(blocked, false);
  });

  it("allows another DM after the 10 minute cooldown expires", async () => {
    const fixture = await createFixture();
    const expiredAt = new Date(Date.now() - DEAL_ROOM_STAFF_MESSAGE_DM_COOLDOWN_MS - 60_000);

    await prisma.secureDealRoomDiscordSession.update({
      where: { id: fixture.sessionId },
      data: { lastStaffMessageDmAt: expiredAt },
    });

    const allowed = await shouldSendStaffDealRoomMessageDm(cooldownInput(fixture));
    assert.equal(allowed, true);
  });

  it("blocks DMs when a recent delivered notification exists even without session timestamp", async () => {
    const fixture = await createFixture();

    const notification = await prisma.userNotification.create({
      data: {
        userId: fixture.applicantUserId,
        type: "DEAL_ROOM_MESSAGE_RECEIVED",
        channel: "IN_APP",
        title: "New message in your Secure Deal Room",
        body: "Earlier staff message",
        discordNotifiedAt: new Date(),
        metadata: {
          dealRoomType: fixture.dealRoomType,
          dealRoomId: fixture.dealRoomId,
          threadId: fixture.threadId,
          messageId: uniqueId("msg"),
          staffUserId: fixture.staffUserId,
        },
      },
    });
    createdNotificationIds.add(notification.id);

    const blocked = await shouldSendStaffDealRoomMessageDm(cooldownInput(fixture));
    assert.equal(blocked, false);
  });

  it("notifyStaffDealRoomMessageBestEffort still creates in-app notifications while DM cooldown is active", async () => {
    const fixture = await createFixture();

    await recordStaffDealRoomMessageDmSent({
      dealRoomType: fixture.dealRoomType,
      dealRoomId: fixture.dealRoomId,
    });

    const beforeCount = await prisma.userNotification.count({
      where: {
        userId: fixture.applicantUserId,
        type: "DEAL_ROOM_MESSAGE_RECEIVED",
      },
    });

    await notifyStaffDealRoomMessageBestEffort(
      notifyInput(fixture, uniqueId("msg"), "Follow-up from Alta Credit Desk"),
    );

    const notifications = await prisma.userNotification.findMany({
      where: {
        userId: fixture.applicantUserId,
        type: "DEAL_ROOM_MESSAGE_RECEIVED",
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    assert.equal(notifications.length, 1);
    createdNotificationIds.add(notifications[0]!.id);
    assert.equal(
      await prisma.userNotification.count({
        where: {
          userId: fixture.applicantUserId,
          type: "DEAL_ROOM_MESSAGE_RECEIVED",
        },
      }),
      beforeCount + 1,
    );
    assert.equal(notifications[0]!.discordNotifiedAt, null);
    assert.equal(notifications[0]!.body, "Follow-up from Alta Credit Desk");
  });

  it("notifyStaffDealRoomMessageBestEffort sends at most one DM burst per cooldown window", async () => {
    const fixture = await createFixture();

    await notifyStaffDealRoomMessageBestEffort(
      notifyInput(fixture, uniqueId("msg-1"), "First message from Alta Credit Desk"),
    );
    await recordStaffDealRoomMessageDmSent({
      dealRoomType: fixture.dealRoomType,
      dealRoomId: fixture.dealRoomId,
    });

    await notifyStaffDealRoomMessageBestEffort(
      notifyInput(fixture, uniqueId("msg-2"), "Second message within cooldown"),
    );
    await notifyStaffDealRoomMessageBestEffort(
      notifyInput(fixture, uniqueId("msg-3"), "Third message within cooldown"),
    );

    const notifications = await prisma.userNotification.findMany({
      where: {
        userId: fixture.applicantUserId,
        type: "DEAL_ROOM_MESSAGE_RECEIVED",
        metadata: {
          path: ["dealRoomId"],
          equals: fixture.dealRoomId,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const notification of notifications) {
      createdNotificationIds.add(notification.id);
    }

    assert.equal(notifications.length, 3);
    assert.equal(
      notifications.filter((notification) => notification.discordNotifiedAt != null).length,
      notifications[0]!.discordNotifiedAt != null ? 1 : 0,
      "only the first eligible message should attempt Discord delivery",
    );
    assert.equal(notifications[1]!.discordNotifiedAt, null);
    assert.equal(notifications[2]!.discordNotifiedAt, null);

    const allowedAfterCooldown = await shouldSendStaffDealRoomMessageDm(cooldownInput(fixture));
    assert.equal(allowedAfterCooldown, false);
  });
});
