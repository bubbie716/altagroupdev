import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ALTA_CARD_TIER_CONFIG, ALTA_CARD_TIER_ORDER } from "./alta-card-tier-config.ts";
import { buildBankPrimaryNavLinks } from "./bank-primary-nav.ts";
import { LOAN_PRODUCT_LABELS } from "./lending-types.ts";
import { footerDocuments, getLegalDocument } from "../legal/legal-document-registry.ts";
import {
  displayRelationshipTierLabel,
  displayRelationshipTierLabelFromCode,
} from "./relationship-terminology.ts";
import { RELATIONSHIP_PREMIER_PROGRESS_CEILING } from "./relationship-intelligence-config.ts";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REPO = path.resolve(SRC, "../..");
const MIGRATIONS = path.resolve(SRC, "../prisma/migrations");

const FORBIDDEN_CUSTOMER_PATTERNS = [
  /Alta Private/,
  /Private Banking/,
  /private_client/,
  /isPrivateClient/,
];

async function collectSourceFiles(dir: string, extensions: Set<string>): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      out.push(...(await collectSourceFiles(full, extensions)));
      continue;
    }
    if (extensions.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

describe("private banking absence", () => {
  it("does not ship deleted Private Banking routes or modules", () => {
    const removed = [
      "routes/bank/private.tsx",
      "routes/bank/private/invitation/$invitationId.tsx",
      "routes/bank/admin/private.tsx",
      "routes/internal/queues/private-banking.tsx",
      "components/bank/alta-private",
      "components/bank/private-tier-card.tsx",
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
    assert.ok(links.some((l) => l.to === "/bank"));
    assert.ok(links.some((l) => l.to === "/bank/accounts"));
    assert.ok(links.some((l) => l.to === "/bank/activity"));
    assert.equal(links.length, 3);
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
      for (const pattern of FORBIDDEN_CUSTOMER_PATTERNS) {
        assert.doesNotMatch(text, pattern, `${rel} matched ${pattern}`);
      }
      assert.doesNotMatch(text, /\/bank\/private/);
    }
  });

  it("has no customer-facing or operator-facing Private Banking copy in active UI source", async () => {
    const roots = [
      path.join(SRC, "components"),
      path.join(SRC, "routes"),
      path.join(SRC, "hooks"),
    ];
    for (const root of roots) {
      if (!existsSync(root)) continue;
      const files = await collectSourceFiles(root, new Set([".ts", ".tsx"]));
      for (const file of files) {
        if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
        const text = await readFile(file, "utf8");
        for (const pattern of FORBIDDEN_CUSTOMER_PATTERNS) {
          assert.doesNotMatch(text, pattern, `${path.relative(SRC, file)} matched ${pattern}`);
        }
      }
    }
  });

  it("maps retained legacy relationship tiers to Premier", () => {
    assert.equal(displayRelationshipTierLabel("PRIVATE_CLIENT", 900), "Premier");
    assert.equal(displayRelationshipTierLabel("PRIVATE_ELIGIBLE", 860), "Premier");
    assert.equal(displayRelationshipTierLabelFromCode("PRIVATE_CLIENT"), "Premier");
    assert.equal(displayRelationshipTierLabelFromCode("PRIVATE_ELIGIBLE"), "Premier");
    assert.equal(RELATIONSHIP_PREMIER_PROGRESS_CEILING, 850);
  });

  it("does not modify historical Prisma migrations", async () => {
    const expected = [
      "20250703250000_core_financial_abstractions",
      "20250703150000_alta_private_invited_timeline",
      "20260722010000_shrink_user_tags",
      "20260724200000_retire_snapshot_private_flag",
    ];
    for (const dir of expected) {
      assert.ok(existsSync(path.join(MIGRATIONS, dir, "migration.sql")), `missing migration ${dir}`);
    }
    // Spot-check that legacy Private Banking symbols remain in historical SQL.
    const core = await readFile(
      path.join(MIGRATIONS, "20250703250000_core_financial_abstractions", "migration.sql"),
      "utf8",
    );
    assert.match(core, /PrivateBankingRelationship/);
  });

  it("companion bot hub has no Alta Private customer surface", async () => {
    const botViews = path.join(REPO, "altabankbot/src/discord/hub/views.ts");
    const botBrand = path.join(REPO, "altabankbot/src/config/brand.ts");
    const botReadme = path.join(REPO, "altabankbot/README.md");
    for (const file of [botViews, botBrand, botReadme]) {
      const text = await readFile(file, "utf8");
      assert.doesNotMatch(text, /Alta Private/);
      assert.doesNotMatch(text, /Private Banking/);
      assert.doesNotMatch(text, /\/bank\/private/);
    }
  });
});
