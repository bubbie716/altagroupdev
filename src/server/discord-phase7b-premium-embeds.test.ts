import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  assertProductTemplateCoverage,
  buildProductPremiumNotification,
  getProductNotificationTemplate,
  isDiscordProductPremiumEmbedsEnabled,
  listProductNotificationTemplates,
} from "@/lib/discord/discord-product-notification-templates.ts";
import { buildNotificationDmPayload } from "@/lib/discord/notification-dm.ts";
import {
  listRegisteredDiscordEventDefinitions,
  resolveDiscordEventDefinition,
} from "@/lib/discord/discord-event-registry.ts";
import { BANK_DISCORD_NOTIFICATION_OPTIONS } from "@/lib/bank/bank-settings-types.ts";
import { planDiscordFanoutDestinations } from "@/lib/discord/discord-secretary-audit-fanout.ts";
import { SEVERITY_COLORS } from "@/lib/discord/discord-premium-embed.ts";
import { isMandatoryDiscordNotification } from "@/lib/bank/notification-pref-rules.ts";

describe("Phase 7B product premium embeds", () => {
  const keys = ["DISCORD_PRODUCT_PREMIUM_EMBEDS", "DISCORD_SECRETARY_AUDIT_FANOUT"] as const;
  const originals = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const k of keys) {
      if (originals[k] === undefined) delete process.env[k];
      else process.env[k] = originals[k];
    }
  });

  it("flag defaults off — legacy notification path (no plainTextFallback)", () => {
    delete process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS;
    assert.equal(isDiscordProductPremiumEmbedsEnabled(), false);
    const payload = buildNotificationDmPayload({
      title: "Deposit approved",
      body: "Your deposit of ƒ100 was approved.",
      eventType: "DEPOSIT_APPROVED",
      linkUrl: "/bank/activity",
    });
    assert.equal(payload.plainTextFallback, undefined);
    assert.ok(payload.embed.title);
  });

  it("Bank deposit/withdrawal success embeds use Bank branding", () => {
    process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS = "true";
    for (const type of ["DEPOSIT_APPROVED", "WITHDRAWAL_APPROVED"] as const) {
      const built = buildProductPremiumNotification({
        eventType: type,
        audience: "customer",
        title: type === "DEPOSIT_APPROVED" ? "Deposit approved" : "Withdrawal approved",
        body: "ƒ250.00 processed (REF-ABC).",
        linkUrl: "/bank/activity",
        metadata: { amount: "250.00", referenceCode: "REF-ABC123456", status: "Completed" },
      });
      assert.ok(built, type);
      assert.equal(built.product, "bank");
      assert.equal(built.brand.footer, "Alta Bank · Newport");
      assert.doesNotMatch(built.brand.footer, /Terminal/);
      assert.equal(built.embed.color, SEVERITY_COLORS.ACTION);
      assert.ok(built.plainText.length > 0);
    }
  });

  it("Bank failed transfer + Alta Pay + card/lending + security embeds", () => {
    process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS = "true";
    const cases = [
      { type: "TRANSFER_FAILED", title: "Transfer failed" },
      { type: "ALTA_PAY_SENT", title: "Alta Pay sent" },
      { type: "LOAN_APPLICATION_APPROVED", title: "Loan application approved" },
      { type: "ALTA_CARD_FROZEN", title: "Alta Card frozen" },
      { type: "BANK_ACCOUNT_OPENED", title: "Bank account opened" },
    ] as const;
    for (const c of cases) {
      const built = buildProductPremiumNotification({
        eventType: c.type,
        audience: "customer",
        title: c.title,
        body: `${c.title}. Token should-not-leak-${"x".repeat(40)} AB-1234-567890`,
        metadata: { accountName: "Checking", referenceCode: "zz99" },
      });
      assert.ok(built, c.type);
      assert.equal(built.product, "bank");
      assert.doesNotMatch(built.plainText, /should-not-leak/);
      assert.doesNotMatch(JSON.stringify(built.embed), /AB-1234-567890/);
      assert.doesNotMatch(built.brand.footer, /Terminal/);
    }
  });

  it("Terminal crypto/funding/scheduled/recon embeds use Terminal branding", () => {
    process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS = "true";
    const cases = [
      "TERMINAL_CRYPTO_ORDER_FILLED",
      "TERMINAL_CRYPTO_ORDER_REJECTED",
      "TERMINAL_CRYPTO_ORDER_FAILED",
      "TERMINAL_FUNDING_COMPLETED",
      "TERMINAL_SCHEDULED_TRADE_CREATED",
      "TERMINAL_CRYPTO_RECON_WARNING",
      "TERMINAL_CRYPTO_RECON_CRITICAL",
      "TERMINAL_PORTFOLIO_CREATED",
    ] as const;
    for (const type of cases) {
      const audience = type.includes("RECON") ? "staff" : "customer";
      const built = buildProductPremiumNotification({
        eventType: type,
        audience,
        title: getProductNotificationTemplate(type, audience)?.defaultTitle ?? type,
        body: "Portfolio activity update",
        metadata: { portfolioName: "Core", orderId: "ord_abcdef123456" },
      });
      assert.ok(built, type);
      assert.equal(built.product, "terminal");
      assert.equal(built.brand.footer, "Alta Terminal · Newport");
      assert.doesNotMatch(built.brand.footer, /Alta Bank/);
    }
  });

  it("never cross-brands Bank and Terminal; Secretary never gets customer DMs", () => {
    process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS = "true";
    process.env.DISCORD_SECRETARY_AUDIT_FANOUT = "true";

    const bank = buildProductPremiumNotification({
      eventType: "DEPOSIT_APPROVED",
      audience: "customer",
      title: "Deposit approved",
      body: "Done",
    });
    assert.ok(bank);
    assert.doesNotMatch(bank.brand.footer, /Terminal|Secretary/);

    const terminal = buildProductPremiumNotification({
      eventType: "TERMINAL_FUNDING_COMPLETED",
      audience: "customer",
      title: "Terminal funding completed",
      body: "Done",
    });
    assert.ok(terminal);
    assert.doesNotMatch(terminal.brand.footer, /Alta Bank|Secretary/);

    const plans = planDiscordFanoutDestinations({
      baseIdempotencyKey: "customer-dm:u1:DEPOSIT_APPROVED:n1",
      product: "bank",
      eventType: "DEPOSIT_APPROVED",
      channelClass: "customer_dm",
      productTargetBot: "bank",
      displayPayload: {
        kind: "customer_dm",
        userId: "u1",
        title: "Deposit approved",
        body: "secret customer body",
      },
    });
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.targetBot, "bank");
    assert.ok(!plans.some((p) => p.targetBot === "secretary"));
  });

  it("fan-out: Bank/Terminal staff product embed + Secretary audit remain separate destinations", () => {
    process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS = "true";
    process.env.DISCORD_SECRETARY_AUDIT_FANOUT = "true";

    const staffPlans = planDiscordFanoutDestinations({
      baseIdempotencyKey: "staff-audit:bank-x",
      product: "bank",
      eventType: "BANK_ACCOUNT_FROZEN",
      channelClass: "staff_ops",
      productTargetBot: "bank",
      displayPayload: {
        kind: "staff_audit",
        content: "Account frozen",
        product: "Alta Bank",
        action: "BANK_ACCOUNT_FROZEN",
        embed: { title: "Account frozen" },
      },
    });
    assert.equal(staffPlans.length, 2);
    assert.ok(staffPlans.some((p) => p.role === "product" && p.targetBot === "bank"));
    assert.ok(staffPlans.some((p) => p.role === "secretary_audit" && p.targetBot === "secretary"));
    assert.notEqual(
      staffPlans[0]?.idempotencyKey,
      staffPlans[1]?.idempotencyKey,
    );

    const termPlans = planDiscordFanoutDestinations({
      baseIdempotencyKey: "staff-audit:term-x",
      product: "terminal",
      eventType: "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
      channelClass: "staff_ops",
      productTargetBot: "terminal",
      displayPayload: {
        kind: "staff_audit",
        content: "Fee updated",
        product: "Alta Terminal",
      },
    });
    assert.ok(termPlans.some((p) => p.targetBot === "terminal"));
    assert.ok(termPlans.some((p) => p.targetBot === "secretary"));
  });

  it("inventory: every Bank/Terminal registry event has a template + preference rules", () => {
    const { covered, missing } = assertProductTemplateCoverage();
    assert.equal(missing.length, 0, `missing templates: ${missing.join(", ")}`);
    assert.ok(covered.length >= 70);

    const prefTypes = new Set(BANK_DISCORD_NOTIFICATION_OPTIONS.map((o) => o.type));
    for (const def of listRegisteredDiscordEventDefinitions()) {
      if (def.product !== "bank" && def.product !== "terminal") continue;
      if (def.classification !== "customer_notification") {
        // Staff/role/security must not appear as customer preference options.
        assert.equal(prefTypes.has(def.eventType as never), false, def.eventType);
        continue;
      }
      assert.ok(def.preferenceGroupId, `${def.eventType} missing preferenceGroupId`);
      if (def.product === "terminal") {
        assert.equal(def.preferenceGroupId, "terminal");
      }
      // Customer Bank/Terminal events that are in UserNotificationType prefs appear in options
      // (some registry-only types may lag — BANK_ACCOUNT_OPENED / TERMINAL_PORTFOLIO_CREATED should be present).
      if (def.eventType === "BANK_ACCOUNT_OPENED" || def.eventType === "TERMINAL_PORTFOLIO_CREATED") {
        assert.ok(prefTypes.has(def.eventType as never), def.eventType);
      }
    }

    assert.equal(isMandatoryDiscordNotification("ALTA_CARD_FROZEN"), true);
  });

  it("malformed / unsupported events fall back safely", () => {
    process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS = "true";
    const missing = buildProductPremiumNotification({
      eventType: "CUSTOMER_DM_DELIVERY_FAILED",
      audience: "customer",
      title: "x",
      body: "y",
    });
    assert.equal(missing, null);

    const legacy = buildNotificationDmPayload({
      title: "Delivery note",
      body: "ops",
      eventType: "CUSTOMER_DM_DELIVERY_FAILED",
    });
    assert.ok(legacy.embed);
    assert.equal(legacy.plainTextFallback, undefined);
  });

  it("lists templates for Bank and Terminal only", () => {
    const all = listProductNotificationTemplates();
    assert.ok(all.length > 50);
    for (const tpl of all) {
      assert.ok(tpl.product === "bank" || tpl.product === "terminal");
      assert.ok(tpl.defaultTitle.trim().length > 0);
      assert.ok(tpl.preferredFields.length > 0);
    }
  });

  it("buildNotificationDmPayload uses premium path when flag on", () => {
    process.env.DISCORD_PRODUCT_PREMIUM_EMBEDS = "true";
    const payload = buildNotificationDmPayload({
      title: "Crypto order filled",
      body: "Sold 10 VLT",
      eventType: "TERMINAL_CRYPTO_ORDER_FILLED",
      linkUrl: "/terminal",
      metadata: { orderId: "order_abc123456789" },
    });
    assert.ok(payload.plainTextFallback);
    assert.equal((payload.embed.footer as { text: string }).text, "Alta Terminal · Newport");
    assert.ok(typeof payload.embed.timestamp === "string");
  });

  it("registry product classification stays correct for covered events", () => {
    assert.equal(resolveDiscordEventDefinition("DEPOSIT_APPROVED").product, "bank");
    assert.equal(resolveDiscordEventDefinition("TERMINAL_FUNDING_FAILED").product, "terminal");
    assert.equal(resolveDiscordEventDefinition("TERMINAL_CRYPTO_RECON_CRITICAL").channelClass, "security_audit");
  });
});
