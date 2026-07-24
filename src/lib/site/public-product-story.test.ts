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

function assertNoNccCopy(text: string, label: string) {
  assert.equal(/\bNCC\b/i.test(text), false, `${label} contains NCC`);
  assert.equal(/Newport Clearing/i.test(text), false, `${label} contains Newport Clearing`);
  assert.equal(/newportclearing/i.test(text), false, `${label} contains newportclearing`);
  assert.equal(/ncc\.altagroup/i.test(text), false, `${label} contains ncc.altagroup`);
}

describe("public product story excludes Alta Exchange and NCC", () => {
  it("ecosystem entries are Group, Bank, and Terminal only", () => {
    assert.deepEqual(
      ECOSYSTEM_ENTRIES.map((e) => e.name),
      ["Alta Group", "Alta Bank", "Alta Terminal"],
    );
  });

  it("governance lists, hierarchy, overview, leadership, and metrics omit Exchange and NCC", () => {
    for (const item of platformStatusItems) {
      const text = `${item.name} ${item.status}`;
      assertNoExchangeCopy(text, "platformStatusItems");
      assertNoNccCopy(text, "platformStatusItems");
    }
    for (const node of groupHierarchy) {
      const text = `${node.name} ${node.status} ${node.description}`;
      assertNoExchangeCopy(text, "groupHierarchy");
      assertNoNccCopy(text, "groupHierarchy");
    }
    for (const entity of entityOverviewItems) {
      const text = `${entity.name} ${entity.status} ${entity.description} ${entity.services.join(" ")}`;
      assertNoExchangeCopy(text, "entityOverview");
      assertNoNccCopy(text, "entityOverview");
    }
    for (const group of divisionLeadership) {
      const text = `${group.sectionTitle} ${group.division}`;
      assertNoExchangeCopy(text, "divisionLeadership");
      assertNoNccCopy(text, "divisionLeadership");
    }
    const metrics = buildGovernancePlatformMetrics(EMPTY_PLATFORM_METRICS);
    for (const row of metrics) {
      const text = `${row.label} ${row.value} ${row.helper ?? ""}`;
      assertNoExchangeCopy(text, "governance metrics");
      assertNoNccCopy(text, "governance metrics");
    }
  });

  it("legal registry and footers omit Exchange and NCC documents and archived categories", () => {
    assert.equal(LEGAL_DOCUMENTS.some((d) => d.id.startsWith("AE-")), false);
    assert.equal(LEGAL_DOCUMENTS.some((d) => d.id.startsWith("NCC-")), false);
    assert.equal(LEGAL_DOCUMENTS.some((d) => d.archived === true), false);
    assert.equal(archivedLegalDocuments().length, 0);
    assert.ok(getLegalDocument("AT-LEGAL-001"));
    assert.equal(getLegalDocument("AE-LEGAL-001")?.id, "AT-LEGAL-001");
    assert.equal(getLegalDocument("AE-LEGAL-002"), undefined);
    assert.equal(getLegalDocument("NCC-LEGAL-001"), undefined);

    const legalDocFiles = readdirSync(join(process.cwd(), "src/content/legal-docs"));
    assert.equal(legalDocFiles.some((name) => name.startsWith("AE-")), false);
    assert.equal(legalDocFiles.some((name) => /^NCC[-_]/i.test(name)), false);
    assert.ok(legalDocFiles.some((name) => name.startsWith("AT-COR-001")));
    for (const id of ["AT-LEGAL-001", "AT-LEGAL-002", "AT-LEGAL-003", "AT-LEGAL-004", "AT-LEGAL-005"]) {
      assert.ok(legalDocFiles.some((name) => name.startsWith(id)), `missing ${id}`);
    }
    for (const id of ["AG-COR-004", "AG-LEGAL-004", "AG-LEGAL-005", "AB-LEGAL-008", "AB-LEGAL-009"]) {
      assert.ok(legalDocFiles.some((name) => name.startsWith(id)), `missing ${id}`);
    }

    for (const doc of footerDocuments()) {
      const text = `${doc.id} ${doc.title} ${doc.label}`;
      assertNoExchangeCopy(text, "footerDocuments");
      assertNoNccCopy(text, "footerDocuments");
    }
    assert.deepEqual(
      siteEntitySectionDocuments("terminal").map((d) => d.id),
      ["AT-LEGAL-001", "AT-LEGAL-002", "AT-LEGAL-003", "AT-LEGAL-004", "AT-LEGAL-005"],
    );
  });

  it("Terminal legal documents contain no Exchange or NCC entity copy", () => {
    const legalDocDir = join(process.cwd(), "src/content/legal-docs");
    for (const filename of readdirSync(legalDocDir).filter((name) => name.startsWith("AT-"))) {
      const body = readFileSync(join(legalDocDir, filename), "utf8");
      assertNoExchangeCopy(body, filename, { allowServiceDiscontinuedVerb: true });
      assertNoNccCopy(body, filename);
    }
  });

  it("site configs and selectors do not expose Exchange or NCC as products", () => {
    assert.equal(Object.prototype.hasOwnProperty.call(SITE_CONFIGS, "ncc"), false);
    for (const site of Object.values(SITE_CONFIGS)) {
      const text = [
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
      ].join(" ");
      assertNoExchangeCopy(text, `SITE_CONFIGS.${site.key}`);
      assertNoNccCopy(text, `SITE_CONFIGS.${site.key}`);
    }
    assertNoExchangeCopy(SITE_FOOTER_EMPHASIS.exchange, "SITE_FOOTER_EMPHASIS.exchange");
    assertNoExchangeCopy(SITE_FOOTER_EMPHASIS.terminal, "SITE_FOOTER_EMPHASIS.terminal");
    assertNoNccCopy(SITE_FOOTER_EMPHASIS.exchange, "SITE_FOOTER_EMPHASIS.exchange");
    assertNoNccCopy(SITE_FOOTER_EMPHASIS.terminal, "SITE_FOOTER_EMPHASIS.terminal");
    for (const tpl of EMBED_TEMPLATES) {
      const text = `${tpl.key} ${tpl.label}`;
      assertNoExchangeCopy(text, "EMBED_TEMPLATES");
      assertNoNccCopy(text, "EMBED_TEMPLATES");
    }
    for (const [key, label] of Object.entries(MAINTENANCE_SCOPE_LABELS)) {
      const text = `${key} ${label}`;
      assertNoExchangeCopy(text, "MAINTENANCE_SCOPE_LABELS");
      assertNoNccCopy(text, "MAINTENANCE_SCOPE_LABELS");
    }
    for (const [key, desc] of Object.entries(MAINTENANCE_SCOPE_DESCRIPTIONS)) {
      const text = `${key} ${desc}`;
      assertNoExchangeCopy(text, "MAINTENANCE_SCOPE_DESCRIPTIONS");
      assertNoNccCopy(text, "MAINTENANCE_SCOPE_DESCRIPTIONS");
    }
    assertNoExchangeCopy(maintenanceTitleForSite("exchange", null), "maintenanceTitleForSite.exchange");
    assertNoExchangeCopy(
      maintenanceTitleForSite("exchange", "exchange"),
      "maintenanceTitleForSite.exchange.scope",
    );
  });
});
