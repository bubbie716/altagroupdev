import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { brandFooterForEvent } from "./discord-branding.ts";
import {
  UnknownDiscordEventError,
  isDiscordProductAwareRoutingEnabled,
  listRegisteredDiscordEventTypes,
  resolveDiscordBrandForEvent,
  resolveDiscordEventDefinition,
  shouldStrictDiscordEventRegistry,
} from "./discord-event-registry.ts";
import { resolveStaffDiscordChannel } from "./discord-channel-routing.ts";
import { buildNotificationDmPayload } from "./notification-dm.ts";

describe("discord event registry", () => {
  const originalAware = process.env.DISCORD_PRODUCT_AWARE_ROUTING;
  const originalStrict = process.env.DISCORD_STRICT_EVENT_REGISTRY;

  afterEach(() => {
    if (originalAware === undefined) delete process.env.DISCORD_PRODUCT_AWARE_ROUTING;
    else process.env.DISCORD_PRODUCT_AWARE_ROUTING = originalAware;
    if (originalStrict === undefined) delete process.env.DISCORD_STRICT_EVENT_REGISTRY;
    else process.env.DISCORD_STRICT_EVENT_REGISTRY = originalStrict;
  });

  it("registers Terminal crypto and funding customer events", () => {
    const filled = resolveDiscordEventDefinition("TERMINAL_CRYPTO_ORDER_FILLED");
    assert.equal(filled.product, "terminal");
    assert.equal(filled.deliveryBot, "bank");
    assert.equal(filled.ownedByBot, "terminal");
    assert.equal(filled.channelClass, "customer_dm");
    assert.equal(filled.preferenceGroupId, "terminal");

    const rejected = resolveDiscordEventDefinition("TERMINAL_CRYPTO_ORDER_REJECTED");
    assert.equal(rejected.product, "terminal");
    assert.equal(resolveDiscordEventDefinition("TERMINAL_FUNDING_FAILED").product, "terminal");

    const portfolioCreated = resolveDiscordEventDefinition("TERMINAL_PORTFOLIO_CREATED");
    assert.equal(portfolioCreated.product, "terminal");
    assert.equal(portfolioCreated.channelClass, "customer_dm");
    assert.equal(portfolioCreated.deliveryBot, "bank");

    const accountOpened = resolveDiscordEventDefinition("BANK_ACCOUNT_OPENED");
    assert.equal(accountOpened.product, "bank");
    assert.equal(accountOpened.channelClass, "customer_dm");
    assert.equal(accountOpened.deliveryBot, "bank");

    const staffFee = resolveDiscordEventDefinition("TERMINAL_CRYPTO_FEE_CONFIG_UPDATED");
    assert.equal(staffFee.ownedByBot, "terminal");
    assert.equal(staffFee.deliveryBot, "terminal");
    assert.equal(staffFee.channelClass, "staff_ops");
  });

  it("registers Secretary ownership for platform ops and delivery alerts", () => {
    const deliveryFailed = resolveDiscordEventDefinition("CUSTOMER_DM_DELIVERY_FAILED");
    assert.equal(deliveryFailed.product, "secretary");
    assert.equal(deliveryFailed.ownedByBot, "secretary");
    assert.equal(deliveryFailed.deliveryBot, "secretary");
    assert.equal(deliveryFailed.channelClass, "delivery_alert");

    const note = resolveDiscordEventDefinition("INTERNAL_NOTE_ADDED");
    assert.equal(note.ownedByBot, "secretary");
    assert.equal(note.deliveryBot, "secretary");

    const companyStaff = resolveDiscordEventDefinition("COMPANY_MEMBER_REMOVED");
    assert.equal(companyStaff.product, "corporate");
    assert.equal(companyStaff.ownedByBot, "secretary");
    assert.equal(companyStaff.deliveryBot, "secretary");

    // Corporate customer DMs stay Bank-delivered.
    const companyCustomer = resolveDiscordEventDefinition("COMPANY_VERIFIED");
    assert.equal(companyCustomer.channelClass, "customer_dm");
    assert.equal(companyCustomer.deliveryBot, "bank");
    assert.equal(companyCustomer.ownedByBot, "secretary");
  });

  it("maps Terminal lifecycle / recon staff events via prefix or exact", () => {
    assert.equal(resolveDiscordEventDefinition("TERMINAL_CRYPTO_STATUS_HALTED").product, "terminal");
    assert.equal(resolveDiscordEventDefinition("TERMINAL_CRYPTO_RECON_CRITICAL").channelClass, "security_audit");
    assert.equal(resolveDiscordEventDefinition("TERMINAL_CRYPTO_FEE_CONFIG_UPDATED").product, "terminal");
  });

  it("throws on unknown event types in strict/test mode", () => {
    process.env.DISCORD_STRICT_EVENT_REGISTRY = "1";
    assert.equal(shouldStrictDiscordEventRegistry(), true);
    assert.throws(
      () => resolveDiscordEventDefinition("TOTALLY_UNKNOWN_EVENT_XYZ"),
      UnknownDiscordEventError,
    );
  });

  it("never brands Terminal events as Alta Bank", () => {
    for (const type of [
      "TERMINAL_CRYPTO_ORDER_FILLED",
      "TERMINAL_CRYPTO_ORDER_REJECTED",
      "TERMINAL_FUNDING_COMPLETED",
      "TERMINAL_SCHEDULED_TRADE_ATTEMPT_FAILED",
    ]) {
      const brand = resolveDiscordBrandForEvent(type);
      assert.equal(brand.footer, "Alta Terminal · Newport");
      assert.ok(!brand.footer.includes("Alta Bank"));
      assert.equal(brandFooterForEvent(type), "Alta Terminal · Newport");
    }
  });

  it("builds customer DM payloads with Terminal footer", () => {
    const payload = buildNotificationDmPayload({
      title: "Crypto purchase filled",
      body: "Bought 1 NVA",
      linkUrl: "/terminal/orders",
      eventType: "TERMINAL_CRYPTO_ORDER_FILLED",
    });
    assert.equal((payload.embed.footer as { text: string }).text, "Alta Terminal · Newport");
    const button = (payload.components[0] as { components: Array<{ label: string }> }).components[0];
    assert.equal(button.label, "View on Alta Terminal");
  });

  it("keeps Bank footer for bank events", () => {
    const payload = buildNotificationDmPayload({
      title: "Transfer completed",
      body: "Done",
      eventType: "TRANSFER_COMPLETED",
    });
    assert.equal((payload.embed.footer as { text: string }).text, "Alta Bank · Newport");
  });

  it("lists a non-empty registry", () => {
    assert.ok(listRegisteredDiscordEventTypes().length > 40);
  });

  it("product-aware channel routing fails closed for Terminal without channel", () => {
    process.env.DISCORD_PRODUCT_AWARE_ROUTING = "true";
    assert.equal(isDiscordProductAwareRoutingEnabled(), true);
    const prevTerminal = process.env.DISCORD_TERMINAL_STAFF_AUDIT_CHANNEL_ID;
    const prevBank = process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID;
    try {
      delete process.env.DISCORD_TERMINAL_STAFF_AUDIT_CHANNEL_ID;
      process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID = "999";
      const route = resolveStaffDiscordChannel({
        product: "terminal",
        channelClass: "staff_ops",
      });
      assert.equal(route.ok, false);
      if (!route.ok) {
        assert.equal(route.reason, "terminal_staff_channel_not_configured");
      }
    } finally {
      if (prevTerminal === undefined) delete process.env.DISCORD_TERMINAL_STAFF_AUDIT_CHANNEL_ID;
      else process.env.DISCORD_TERMINAL_STAFF_AUDIT_CHANNEL_ID = prevTerminal;
      if (prevBank === undefined) delete process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID;
      else process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID = prevBank;
    }
  });

  it("legacy routing uses Bank staff channel when product-aware is off", () => {
    delete process.env.DISCORD_PRODUCT_AWARE_ROUTING;
    const prevBank = process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID;
    try {
      process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID = "111";
      const route = resolveStaffDiscordChannel({
        product: "terminal",
        channelClass: "staff_ops",
      });
      assert.equal(route.ok, true);
      if (route.ok) assert.equal(route.channelId, "111");
    } finally {
      if (prevBank === undefined) delete process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID;
      else process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID = prevBank;
    }
  });
});
