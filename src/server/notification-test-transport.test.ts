import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  assertLiveNotificationTransportAllowed,
  clearRecordedNotificationMessages,
  enableTestNotificationTransport,
  getRecordedNotificationMessages,
  isTestNotificationTransportActive,
} from "@/server/notification-test-transport";

describe("notification test transport", () => {
  beforeEach(() => {
    enableTestNotificationTransport();
    clearRecordedNotificationMessages();
  });

  afterEach(() => {
    clearRecordedNotificationMessages();
  });

  it("records Discord-bound messages in memory under test transport", async () => {
    assert.equal(isTestNotificationTransportActive(), true);

    const { deliverNotificationDiscord } = await import("@/server/notification.service");
    await deliverNotificationDiscord("notif-test-1", {
      userId: "user-commercial-1",
      type: "COMMERCIAL_PRO_ACTIVATED",
      title: "Commercial Pro activated",
      body: "Your company plan is now Pro.",
      linkUrl: "/bank/commercial",
      linkLabel: "Open Commercial",
    });

    const recorded = getRecordedNotificationMessages();
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0]?.notificationId, "notif-test-1");
    assert.equal(recorded[0]?.userId, "user-commercial-1");
    assert.equal(recorded[0]?.type, "COMMERCIAL_PRO_ACTIVATED");
    assert.equal(recorded[0]?.title, "Commercial Pro activated");
    assert.equal(recorded[0]?.body, "Your company plan is now Pro.");
    assert.equal(recorded[0]?.linkUrl, "/bank/commercial");
    assert.equal(recorded[0]?.linkLabel, "Open Commercial");
    assert.ok(typeof recorded[0]?.recordedAt === "string");
  });

  it("blocks live Discord delivery implementations", async () => {
    const { sendDiscordNotificationDm } = await import("@/server/discord-dm.service");
    await assert.rejects(
      () =>
        sendDiscordNotificationDm("discord-user-1", {
          embed: { title: "Blocked", description: "Should not send" },
          components: [],
        }),
      /LIVE_NOTIFICATION_TRANSPORT_BLOCKED:sendDiscordUserDm/,
    );

    const { deliverUserNotificationDm } = await import(
      "@/server/bot-notification-delivery.service"
    );
    await assert.rejects(
      () =>
        deliverUserNotificationDm({
          userId: "user-1",
          title: "Blocked",
          body: "Should not send",
        }),
      /LIVE_NOTIFICATION_TRANSPORT_BLOCKED:deliverUserNotificationDm/,
    );

    const { dispatchNotificationDm } = await import(
      "@/server/notification-discord-dispatch.service"
    );
    await assert.rejects(
      () =>
        dispatchNotificationDm({
          userId: "user-1",
          title: "Blocked",
          body: "Should not send",
        }),
      /LIVE_NOTIFICATION_TRANSPORT_BLOCKED:dispatchNotificationDm/,
    );
  });

  it("blocks commercial notification live Discord delivery paths", async () => {
    assert.throws(
      () => assertLiveNotificationTransportAllowed("commercial-notification"),
      /LIVE_NOTIFICATION_TRANSPORT_BLOCKED:commercial-notification/,
    );

    const { deliverCustomerNotificationDm } = await import(
      "@/server/customer-notification-delivery.service"
    );
    await assert.rejects(
      () =>
        deliverCustomerNotificationDm({
          notificationId: "notif-commercial-1",
          userId: "user-commercial-1",
          type: "COMMERCIAL_PRO_ACTIVATED",
          title: "Commercial Pro activated",
          body: "Your company plan is now Pro.",
          linkUrl: "/bank/commercial",
        }),
      /LIVE_NOTIFICATION_TRANSPORT_BLOCKED:deliverCustomerNotificationDm/,
    );

    assert.equal(getRecordedNotificationMessages().length, 0);
  });
});
