import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ALTA_CARD_TIER_CONFIG, ALTA_CARD_TIER_ORDER } from "./alta-card-tier-config.ts";
import { buildBankPrimaryNavLinks } from "./bank-primary-nav.ts";
import { LOAN_PRODUCT_LABELS } from "./lending-types.ts";
import { footerDocuments, getLegalDocument } from "../legal/legal-document-registry.ts";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("private banking absence", () => {
  it("does not ship deleted Private Banking routes or modules", () => {
    const removed = [
      "routes/bank/private.tsx",
      "routes/bank/private/invitation/$invitationId.tsx",
      "routes/bank/admin/private.tsx",
      "routes/internal/queues/private-banking.tsx",
      "components/bank/alta-private",
      "components/internal/alta-private-admin-panel.tsx",
      "components/internal/queues/private-banking-queue-view.tsx",
      "lib/bank/alta-private.functions.ts",
      "lib/bank/alta-private-types.ts",
      "lib/bank/alta-private-invitation-rules.ts",
      "lib/bank/alta-private-client-experience.ts",
      "hooks/use-alta-private-client-context.ts",
      "server/alta-private-invitation.service.ts",
      "server/alta-private-timeline.service.ts",
      "server/alta-private-discord.service.ts",
      "content/legal-docs/AB-LEGAL-009-Alta-Private-Terms.md",
    ];
    for (const rel of removed) {
      assert.equal(existsSync(path.join(SRC, rel)), false, `expected removed: ${rel}`);
    }
  });

  it("keeps Alta Gold as a standalone card tier", () => {
    assert.ok(ALTA_CARD_TIER_ORDER.includes("gold"));
    assert.equal(ALTA_CARD_TIER_CONFIG.gold.label, "Alta Gold");
    assert.match(ALTA_CARD_TIER_CONFIG.gold.description, /Alta Bank/i);
    assert.doesNotMatch(ALTA_CARD_TIER_CONFIG.gold.description, /Private/i);
    assert.equal("isPrivateOnly" in ALTA_CARD_TIER_CONFIG.gold, false);
  });

  it("omits Private Banking from bank primary nav", () => {
    const links = buildBankPrimaryNavLinks({
      creditDesk: {
        showLendingNav: true,
        showAltaCardNav: true,
        creditDeskClosed: false,
        showApplyEntryPoints: true,
      },
    });
    for (const item of links) {
      assert.doesNotMatch(item.label, /Private/i);
      assert.doesNotMatch(item.to, /\/private/i);
    }
    assert.ok(links.some((l) => l.to === "/bank/alta-card"));
  });

  it("does not label retained loan enum as Private Banking", () => {
    assert.equal(LOAN_PRODUCT_LABELS.private_liquidity_line, "Negotiated Liquidity Line");
    assert.doesNotMatch(LOAN_PRODUCT_LABELS.private_liquidity_line, /Private/i);
  });

  it("removes Alta Private Terms from the legal registry and footers", () => {
    assert.equal(getLegalDocument("AB-LEGAL-009"), undefined);
    for (const doc of footerDocuments()) {
      assert.doesNotMatch(doc.title, /Alta Private/i);
      assert.doesNotMatch(doc.slug, /alta-private/i);
    }
    assert.ok(getLegalDocument("AB-LEGAL-006"));
  });

  it("keeps Gold Card marketing free of Private Banking branding", async () => {
    const files = [
      "lib/bank/alta-card-tier-config.ts",
      "components/bank/alta-card/alta-card-tier-comparison.tsx",
      "components/bank/alta-card/alta-card-landing-hero.tsx",
      "components/bank/alta-card/alta-card-apply-form.tsx",
      "components/bank/alta-card/alta-card-review-form.tsx",
      "components/site/homepages/bank-homepage.tsx",
      "lib/bank/data.ts",
      "routes/bank/products.tsx",
      "routes/profile.tsx",
    ];
    for (const rel of files) {
      const text = await readFile(path.join(SRC, rel), "utf8");
      assert.doesNotMatch(text, /Alta Private/);
      assert.doesNotMatch(text, /Private Banking/);
      assert.doesNotMatch(text, /\/bank\/private/);
      assert.doesNotMatch(text, /private_client/);
      assert.doesNotMatch(text, /isPrivateClient/);
    }
  });
});
