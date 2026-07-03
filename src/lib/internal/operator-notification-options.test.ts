import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOperatorNotificationAuditMetadata,
  shouldNotifyCustomer,
} from "./operator-notification-options.ts";

describe("operator notification options", () => {
  it("notifies customers by default", () => {
    assert.equal(shouldNotifyCustomer(undefined), true);
    assert.equal(shouldNotifyCustomer({}), true);
    assert.equal(shouldNotifyCustomer({ silentNotification: false }), true);
  });

  it("skips customer notifications when silent", () => {
    assert.equal(shouldNotifyCustomer({ silentNotification: true }), false);
  });

  it("records silent mode and actor in audit metadata", () => {
    const meta = buildOperatorNotificationAuditMetadata("staff-1", { silentNotification: true }, false);
    assert.equal(meta.silentNotification, true);
    assert.equal(meta.customerNotificationSent, false);
    assert.equal(meta.silentNotificationChosenByUserId, "staff-1");
  });

  it("records successful customer notification in audit metadata", () => {
    const meta = buildOperatorNotificationAuditMetadata("staff-2", { silentNotification: false }, true);
    assert.equal(meta.silentNotification, false);
    assert.equal(meta.customerNotificationSent, true);
    assert.equal(meta.silentNotificationChosenByUserId, null);
  });
});
