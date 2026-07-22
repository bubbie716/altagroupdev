import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { SITE_CONFIGS } from "@/config/sites";
import { EMBED_TEMPLATES } from "@/lib/discord/embed-types";
import {
  divisionLeadership,
  entityOverviewItems,
  groupHierarchy,
  platformStatusItems,
} from "@/lib/governance/content";
import {
  archivedLegalDocuments,
  footerDocuments,
  getLegalDocument,
  LEGAL_DOCUMENTS,
  siteEntitySectionDocuments,
} from "@/lib/legal/legal-document-registry";
import { buildGovernancePlatformMetrics } from "@/lib/metrics/governance-metrics";
import { EMPTY_PLATFORM_METRICS } from "@/lib/metrics/platform-metrics.functions";
import {
  MAINTENANCE_SCOPE_DESCRIPTIONS,
  MAINTENANCE_SCOPE_LABELS,
  maintenanceTitleForSite,
} from "@/lib/platform/maintenance-types";
import { ECOSYSTEM_ENTRIES } from "@/lib/site/ecosystem-config";
import { SITE_FOOTER_EMPHASIS } from "@/lib/site/site-links";

function assertNoExchangeCopy(text: string, label: string, options?: { allowServiceDiscontinuedVerb?: boolean }) {
  assert.equal(/Alta Exchange/i.test(text), false, `${label} contains Alta Exchange`);
  assert.equal(/Exchange N\.V\./i.test(text), false, `${label} contains Exchange N.V.`);
  if (!options?.allowServiceDiscontinuedVerb) {
    assert.equal(/\bDiscontinued\b/i.test(text), false, `${label} contains Discontinued`);
  }
}

describe("public product story excludes Alta Exchange", () => {
  it("ecosystem entries are Group, Bank, and Terminal only", () => {
    assert.deepEqual(
      ECOSYSTEM_ENTRIES.map((e) => e.name),
      ["Alta Group", "Alta Bank", "Alta Terminal"],
    );
  });

  it("governance lists, hierarchy, overview, leadership, and metrics omit Exchange", () => {
    for (const item of platformStatusItems) {
      assertNoExchangeCopy(`${item.name} ${item.status}`, "platformStatusItems");
    }
    for (const node of groupHierarchy) {
      assertNoExchangeCopy(`${node.name} ${node.status} ${node.description}`, "groupHierarchy");
    }
    for (const entity of entityOverviewItems) {
      assertNoExchangeCopy(
        `${entity.name} ${entity.status} ${entity.description} ${entity.services.join(" ")}`,
        "entityOverview",
      );
    }
    for (const group of divisionLeadership) {
      assertNoExchangeCopy(`${group.sectionTitle} ${group.division}`, "divisionLeadership");
    }
    const metrics = buildGovernancePlatformMetrics(EMPTY_PLATFORM_METRICS);
    for (const row of metrics) {
      assertNoExchangeCopy(`${row.label} ${row.value} ${row.helper ?? ""}`, "governance metrics");
    }
  });

  it("legal registry and footers omit Exchange documents and archived categories", () => {
    assert.equal(LEGAL_DOCUMENTS.some((d) => d.id.startsWith("AE-")), false);
    assert.equal(LEGAL_DOCUMENTS.some((d) => d.archived === true), false);
    assert.equal(archivedLegalDocuments().length, 0);
    assert.ok(getLegalDocument("AT-LEGAL-001"));
    assert.equal(getLegalDocument("AE-LEGAL-001")?.id, "AT-LEGAL-001");
    assert.equal(getLegalDocument("AE-LEGAL-002"), undefined);

    const legalDocFiles = readdirSync(join(process.cwd(), "src/content/legal-docs"));
    assert.equal(legalDocFiles.some((name) => name.startsWith("AE-")), false);
    assert.ok(legalDocFiles.some((name) => name.startsWith("AT-LEGAL-001")));

    for (const doc of footerDocuments()) {
      assertNoExchangeCopy(`${doc.id} ${doc.title} ${doc.label}`, "footerDocuments");
    }
    assert.deepEqual(
      siteEntitySectionDocuments("terminal").map((d) => d.id),
      ["AT-LEGAL-001"],
    );
  });

  it("Terminal agreement body contains no Alta Exchange text", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/legal-docs/AT-LEGAL-001-Alta-Terminal-Customer-Agreement.md"),
      "utf8",
    );
    assertNoExchangeCopy(body, "AT-LEGAL-001", { allowServiceDiscontinuedVerb: true });
  });

  it("site configs and selectors do not label an Exchange product as discontinued", () => {
    for (const site of Object.values(SITE_CONFIGS)) {
      assertNoExchangeCopy(
        [
          site.entityName,
          site.displayName,
          site.description,
          site.tagline,
          site.loginEyebrow,
          site.loginHome.panelTitle,
          site.loginHome.panelDescription,
          site.loginHome.panelTags.join(" "),
          site.seo.title,
          site.seo.description,
        ].join(" "),
        `SITE_CONFIGS.${site.key}`,
      );
    }
    assertNoExchangeCopy(SITE_FOOTER_EMPHASIS.exchange, "SITE_FOOTER_EMPHASIS.exchange");
    assertNoExchangeCopy(SITE_FOOTER_EMPHASIS.terminal, "SITE_FOOTER_EMPHASIS.terminal");
    for (const tpl of EMBED_TEMPLATES) {
      assertNoExchangeCopy(`${tpl.key} ${tpl.label}`, "EMBED_TEMPLATES");
    }
    for (const [key, label] of Object.entries(MAINTENANCE_SCOPE_LABELS)) {
      assertNoExchangeCopy(`${key} ${label}`, "MAINTENANCE_SCOPE_LABELS");
    }
    for (const [key, desc] of Object.entries(MAINTENANCE_SCOPE_DESCRIPTIONS)) {
      assertNoExchangeCopy(`${key} ${desc}`, "MAINTENANCE_SCOPE_DESCRIPTIONS");
    }
    assertNoExchangeCopy(maintenanceTitleForSite("exchange", null), "maintenanceTitleForSite.exchange");
    assertNoExchangeCopy(
      maintenanceTitleForSite("exchange", "exchange"),
      "maintenanceTitleForSite.exchange.scope",
    );
  });
});
