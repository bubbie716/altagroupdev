import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPremiumEmbed,
  premiumEmbedSnapshot,
  PRODUCT_ACCENT_COLORS,
  SEVERITY_COLORS,
  validatePremiumEmbedInput,
} from "./discord-premium-embed.ts";

describe("premium Discord embeds", () => {
  it("builds Bank transaction embed with Bank footer and severity color", () => {
    const built = buildPremiumEmbed({
      product: "bank",
      eventType: "TRANSFER_COMPLETED",
      severity: "ACTION",
      title: "Transfer completed",
      description: "ƒ100.00 sent",
      fields: [{ name: "Status", value: "Completed", inline: true }],
      linkUrl: "/bank/activity",
      correlationId: "ref-1",
    });
    const snap = premiumEmbedSnapshot(built);
    assert.equal(snap.footer, "Alta Bank · Newport");
    assert.equal(snap.color, SEVERITY_COLORS.ACTION);
    assert.equal(snap.hasTimestamp, true);
    assert.ok(snap.fieldNames.includes("Status"));
    assert.ok(snap.fieldNames.includes("Reference"));
    assert.ok(built.plainText.includes("Transfer completed"));
    assert.ok(built.components.length >= 1);
  });

  it("builds Terminal order embed without Bank branding", () => {
    const built = buildPremiumEmbed({
      product: "terminal",
      eventType: "TERMINAL_CRYPTO_ORDER_FILLED",
      severity: "ACTION",
      title: "Order filled",
      description: "Sold 10 VLT",
    });
    const snap = premiumEmbedSnapshot(built);
    assert.equal(snap.brandFooter, "Alta Terminal · Newport");
    assert.doesNotMatch(String(snap.footer), /Alta Bank/);
  });

  it("builds Secretary ops/security language footer", () => {
    const built = buildPremiumEmbed({
      product: "secretary",
      eventType: "CUSTOMER_DM_DELIVERY_FAILED",
      severity: "WARNING",
      title: "Delivery failed",
    });
    assert.equal(premiumEmbedSnapshot(built).footer, "Alta Secretary · Newport");
    assert.doesNotMatch(String(premiumEmbedSnapshot(built).footer), /Alta Bank|Alta Terminal/);
  });

  it("redacts account numbers from fields", () => {
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

  it("validates content length", () => {
    assert.equal(validatePremiumEmbedInput({ product: "bank", eventType: "X", title: "" }).ok, false);
    assert.equal(
      validatePremiumEmbedInput({
        product: "bank",
        eventType: "X",
        title: "ok",
        fields: Array.from({ length: 26 }, (_, i) => ({ name: `f${i}`, value: "v" })),
      }).ok,
      false,
    );
  });

  it("exposes product accent colors distinct from severity overrides", () => {
    assert.notEqual(PRODUCT_ACCENT_COLORS.bank, SEVERITY_COLORS.CRITICAL);
    assert.notEqual(PRODUCT_ACCENT_COLORS.terminal, PRODUCT_ACCENT_COLORS.bank);
  });
});
