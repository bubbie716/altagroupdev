/**
 * Discord Phase 6 — Terminal Investor lifecycle, premium embed cutover, operator panel.
 * Fully offline (DISCORD_TEST_MODE / delivery guard preload).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { buildStaffAuditPremiumPayload } from "./staff-audit-notification.service.ts";
import {
  buildPremiumEmbed,
  premiumEmbedSnapshot,
  SEVERITY_COLORS,
} from "@/lib/discord/discord-premium-embed.ts";
import { applyDiscordProductRole } from "./discord-product-role.service.ts";
import { deliverDiscordOutboxPayload } from "./discord-outbox.service.ts";
import { isDiscordLiveDeliveryDisabled } from "@/lib/discord/discord-delivery-guard.ts";

const ROOT = process.cwd();

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Phase 6 — Terminal Investor lifecycle wiring", () => {
  it("portfolio create enqueues Investor grant after commit (not inside tx)", () => {
    const src = readSrc("src/lib/terminal/terminal-portfolio.service.ts");
    assert.match(src, /enqueueTerminalInvestorRoleGrantAfterActivation/);
    assert.match(src, /terminal_portfolio_activated/);
    // Must be after the transaction returns (void import after $transaction).
    const txIdx = src.indexOf("prisma.$transaction");
    const enqueueIdx = src.indexOf("enqueueTerminalInvestorRoleGrantAfterActivation");
    assert.ok(txIdx >= 0 && enqueueIdx > txIdx);
  });

  it("archive surfaces pending reconcile and does not auto-revoke", () => {
    const src = readSrc("src/lib/terminal/terminal-portfolio.service.ts");
    assert.match(src, /surfaceTerminalInvestorIneligibilityPendingReconcile/);
    assert.match(src, /terminal_portfolio_archived_pending_reconcile/);
    assert.doesNotMatch(
      src.slice(src.indexOf("archiveTerminalPortfolio")),
      /preferRevokeWhenIneligible:\s*true/,
    );
  });

  it("activation enqueue uses portfolio-scoped idempotency suffix", () => {
    const src = readSrc("src/server/discord-product-role.service.ts");
    assert.match(src, /idempotencyKeySuffix:\s*`portfolio:\$\{input\.portfolioId\}:activation`/);
    assert.match(src, /portfolio_not_active_or_unauthorized/);
    assert.match(src, /discord_identity_missing/);
    assert.match(src, /export async function enqueueTerminalInvestorRoleGrantAfterActivation/);
  });

  it("role sync service refuses cross-product Terminal→Bank apply", async () => {
    process.env.DISCORD_BANK_CLIENT_ROLE_ID = "role-1";
    process.env.DISCORD_BANK_GUILD_ID = "guild-1";
    process.env.DISCORD_BANK_BOT_TOKEN = "Bot.fake";
    const result = await applyDiscordProductRole({
      productRole: "bank_client",
      action: "grant",
      discordUserId: "u1",
      requiredTargetBot: "terminal",
      skipEligibilityCheck: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "cross_product_role_refused");
  });
});

describe("Phase 6 — premium embed migration", () => {
  it("staff audit builds Bank / Terminal / Secretary branding without cross-branding", () => {
    const bank = buildStaffAuditPremiumPayload({
      product: "Alta Bank",
      action: "Transfer completed",
      eventType: "TRANSFER_COMPLETED",
      actorLabel: "Ops",
      details: "ƒ10.00",
      severity: "ACTION",
      dedupeKey: "xfer-1",
      internalUrl: "/internal/bank",
    });
    assert.ok(bank.embed.title);
    assert.equal((bank.embed.footer as { text: string }).text, "Alta Bank · Newport");
    assert.equal(bank.embed.color, SEVERITY_COLORS.ACTION);
    assert.ok(bank.content.length > 0);

    const terminal = buildStaffAuditPremiumPayload({
      product: "Alta Terminal",
      action: "Crypto order filled",
      eventType: "TERMINAL_CRYPTO_ORDER_FILLED",
      actorLabel: "System",
      severity: "ACTION",
      dedupeKey: "term-1",
    });
    assert.equal((terminal.embed.footer as { text: string }).text, "Alta Terminal · Newport");
    assert.doesNotMatch(String(terminal.embed.footer), /Alta Bank/);

    const secretary = buildStaffAuditPremiumPayload({
      product: "Alta Ops",
      action: "Delivery failed",
      eventType: "CUSTOMER_DM_DELIVERY_FAILED",
      actorLabel: "System",
      severity: "WARNING",
      dedupeKey: "sec-1",
    });
    // Ops product maps to ops brand; registry event may route secretary severity path.
    assert.ok(secretary.embed.footer);
    assert.doesNotMatch(String(secretary.embed.footer), /Alta Bank/);
    assert.doesNotMatch(String(secretary.embed.footer), /Alta Terminal/);
  });

  it("redacts sensitive account numbers in premium embeds", () => {
    const built = buildPremiumEmbed({
      product: "bank",
      eventType: "TRANSFER_FAILED",
      severity: "WARNING",
      title: "Transfer failed",
      fields: [{ name: "From", value: "AB-1234-567890" }],
    });
    const fields = built.embed.fields as Array<{ value: string }>;
    assert.match(fields[0]!.value, /\*\*/);
    assert.doesNotMatch(fields[0]!.value, /567890/);
  });

  it("keeps plain-text fallback and does not double-send in notification service", () => {
    const src = readSrc("src/server/staff-audit-notification.service.ts");
    assert.match(src, /buildStaffAuditPremiumPayload|buildEventPremiumEmbed/);
    assert.match(src, /never a second send|Plain-text fallback/);
    // Single dispatchStaffAuditDiscordMessage call site in async path.
    const matches = src.match(/dispatchStaffAuditDiscordMessage\(/g) ?? [];
    assert.equal(matches.length, 1);
  });

  it("outbox staff_audit payload carries embed without treating role_mgmt as customer_dm", async () => {
    let staffCalls = 0;
    let dmCalls = 0;
    const result = await deliverDiscordOutboxPayload(
      {
        kind: "staff_audit",
        content: "plain fallback",
        product: "Alta Terminal",
        action: "Order filled",
        embed: { title: "Order filled", color: 1 },
        components: [],
      },
      {
        dispatchCustomerDm: async () => {
          dmCalls += 1;
          return { sent: false };
        },
        dispatchStaffAudit: async (content, options) => {
          staffCalls += 1;
          assert.equal(content, "plain fallback");
          assert.ok(options?.embed);
          return { sent: true };
        },
      },
    );
    assert.equal(result.sent, true);
    assert.equal(staffCalls, 1);
    assert.equal(dmCalls, 0);

    const role = await deliverDiscordOutboxPayload(
      {
        kind: "role_mgmt",
        action: "grant",
        productRole: "terminal_investor",
        discordUserId: "d1",
        roleId: "r1",
      },
      {
        dispatchCustomerDm: async () => {
          dmCalls += 1;
          return { sent: true };
        },
        dispatchStaffAudit: async () => {
          staffCalls += 1;
          return { sent: true };
        },
        dispatchRoleMgmt: async () => ({ sent: true, reason: "ok" }),
      },
    );
    assert.equal(role.sent, true);
    assert.equal(dmCalls, 0);
  });

  it("configured credentials cannot HTTP-deliver in tests", async () => {
    assert.equal(isDiscordLiveDeliveryDisabled(), true);
    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("unreachable");
    }) as typeof fetch;
    try {
      const { dispatchStaffAuditDiscordMessage } = await import(
        "./staff-audit-discord-dispatch.service.ts"
      );
      const result = await dispatchStaffAuditDiscordMessage("hello", {
        product: "bank",
        embed: { title: "x" },
      });
      assert.equal(result.sent, false);
      assert.equal(result.reason, "disabled_in_test");
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Phase 6 — operator role panel", () => {
  it("panel surfaces eligibility, owner bot, outbox, and live-unavailable state", () => {
    const panel = readSrc("src/components/internal/internal-discord-role-panel.tsx");
    assert.match(panel, /Eligibility/);
    assert.match(panel, /Owner bot/);
    assert.match(panel, /live member roles unavailable/);
    assert.match(panel, /Retry failed sync/);
    assert.match(panel, /outboxStateLabel|Outbox:/);
    assert.match(panel, /useUiLabMutationGate/);
  });

  it("server functions gate UI Lab mutations and do not fetch live roles by default", () => {
    const fns = readSrc("src/lib/internal/discord-role-sync.functions.ts");
    assert.match(fns, /assertNotUiLabMutation/);
    assert.match(fns, /fetchLiveRoles:\s*false/);
    assert.match(fns, /retryDiscordRoleSyncOutbox/);
    assert.match(fns, /reconcileDiscordProductRole/);
  });

  it("snapshot model never invents live role presence when unavailable", () => {
    const src = readSrc("src/server/discord-product-role.service.ts");
    assert.match(src, /liveRoleStateAvailable/);
    assert.match(src, /live_member_roles_unavailable/);
    assert.match(src, /live_member_roles_not_fetched/);
    assert.match(src, /ownerBot/);
  });

  it("outbox health includes role_mgmt counts by bot", () => {
    const src = readSrc("src/server/discord-outbox.service.ts");
    assert.match(src, /roleMgmtByBot/);
    assert.match(src, /channelClass:\s*"role_mgmt"/);
  });
});

describe("Phase 6 — embed deep links + timestamps", () => {
  const keys = ["ALTA_WEB_BASE_URL"] as const;
  const original: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key]!;
    }
  });

  it("includes timestamp, deep link button, and severity color", () => {
    original.ALTA_WEB_BASE_URL = process.env.ALTA_WEB_BASE_URL;
    process.env.ALTA_WEB_BASE_URL = "https://bank.alta.example";
    const built = buildPremiumEmbed({
      product: "terminal",
      eventType: "TERMINAL_CRYPTO_ORDER_FILLED",
      severity: "CRITICAL",
      title: "Reconciliation required",
      linkUrl: "/terminal/inbox",
      correlationId: "corr-9",
    });
    const snap = premiumEmbedSnapshot(built);
    assert.equal(snap.hasTimestamp, true);
    assert.equal(snap.color, SEVERITY_COLORS.CRITICAL);
    assert.ok(snap.fieldNames.includes("Reference"));
    assert.ok(built.components.length >= 1);
    assert.ok(String(built.embed.url).includes("/terminal/inbox"));
  });
});
