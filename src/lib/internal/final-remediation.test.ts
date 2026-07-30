import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  countUiLabActiveInternalAccounts,
  getUiLabInternalBankAccountDetail,
  getUiLabInternalBankAccountRows,
  getUiLabInternalBankOpsSummary,
  UI_LAB_INTERNAL_ACCOUNT_IDS,
} from "@/lib/bank/ui-lab-money-ops-fixtures";
import {
  getUiLabCustomer360,
  listUiLabResolvablePartyIds,
  uiLabPartyHasResolvableWorkspace,
  UI_LAB_PARTY_CATALOG,
} from "@/lib/bank/ui-lab-party-catalog";
import {
  UI_LAB_HARBOR_COMPANY_ID,
  UI_LAB_PAYABLE_RECIPIENTS,
  getUiLabInvoiceDetail,
  UI_LAB_CORE_COMPANY_ID,
} from "@/lib/bank/ui-lab-commercial-fixtures";
import {
  normalizeInternalSearch,
  serializeInternalSearch,
} from "@/lib/internal/normalize-internal-search";
import {
  internalDocumentTitle,
  internalDocumentTitleSuffix,
} from "@/lib/internal/internal-document-title";
import { resolveInternalRouteTitle } from "@/lib/internal/internal-route-title";
import { measureOpsSearchPhaseMs } from "@/server/ops-global-search.service";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("final remediation — Inbox primary-action navigation", () => {
  it("uses a synchronous outbound navigation ref to prevent clearCase races", () => {
    const page = read("components/internal/inbox/inbox-page.tsx");
    assert.match(page, /outboundNavRef/);
    assert.match(page, /outboundNavRef\.current = true/);
    assert.match(page, /if \(outboundNavRef\.current\) return/);
    assert.match(page, /beginOutboundNavigation/);
    assert.doesNotMatch(page, /navigatingAway/);
    assert.match(page, /matchMedia\("\(max-width: 1023px\)"\)/);
    assert.match(page, /selectedCaseId/);
    assert.doesNotMatch(
      page.slice(page.indexOf("function selectCase"), page.indexOf("function clearCase")),
      /updateSearch/,
    );

    const actions = read("components/internal/inbox/inbox-case-actions.tsx");
    const navigation = read("lib/internal/inbox-navigation.ts");
    assert.match(actions, /buildInboxRecordHref/);
    assert.match(actions, /href=\{recordHref\}/);
    assert.match(actions, /onBeginNavigate\?\.\(\)/);
    assert.match(navigation, /materializeInboxDestination/);
    assert.match(navigation, /normalizeInternalSearch/);
    assert.match(navigation, /buildInboxReturnPath|returnFrom/);
  });

  it("covers open/review destinations for each inbox case type", () => {
    const types = read("lib/internal/inbox-types.ts");
    for (const type of [
      "deposit",
      "withdrawal",
      "account_opening",
      "company_verification",
      "lending_application",
      "alta_card_application",
      "alta_card_review",
      "deal_room",
      "exception",
    ]) {
      assert.match(types, new RegExp(`"${type}"`));
    }
    const normalize = read("lib/internal/inbox-normalize.ts");
    assert.match(normalize, /destination:\s*\{/);
    assert.match(
      normalize,
      /actions:.*"review"|actions:.*"open"|includes\("review"\)|includes\("open"\)/,
    );
    const terminalInbox = read("lib/terminal/ui-lab/ui-lab-terminal-ops-fixtures.ts");
    assert.match(terminalInbox, /terminal_order|restricted/);
  });
});

describe("final remediation — Alta Pay related-record integrity", () => {
  it("resolves every payable person with hasInternalRecord via customer 360 fixtures", () => {
    for (const recipient of UI_LAB_PAYABLE_RECIPIENTS.filter((r) => r.kind === "person")) {
      const party = UI_LAB_PARTY_CATALOG.find((p) => p.id === recipient.id);
      assert.ok(party, `missing party catalog entry for ${recipient.id}`);
      if (party.hasInternalRecord) {
        assert.equal(uiLabPartyHasResolvableWorkspace(recipient.id), true);
        const fixture = getUiLabCustomer360(recipient.id);
        assert.ok(fixture, `customer 360 missing for ${recipient.id}`);
        assert.equal(fixture!.user.id, recipient.id);
      } else {
        assert.equal(uiLabPartyHasResolvableWorkspace(recipient.id), false);
        assert.equal(getUiLabCustomer360(recipient.id), null);
      }
    }
  });

  it("uses CO-HBR for Harbor company so seed/company workspace can resolve", () => {
    assert.equal(UI_LAB_HARBOR_COMPANY_ID, "CO-HBR");
    assert.equal(uiLabPartyHasResolvableWorkspace(UI_LAB_HARBOR_COMPANY_ID), true);
  });

  it("marks invoice related parties linkable only when resolvable", () => {
    const view = read("components/internal/workspace/invoice-workspace-view.tsx");
    assert.match(view, /uiLabPartyHasResolvableWorkspace/);
    assert.match(view, /linkable/);
    assert.match(view, /no internal record/);
  });

  it("enumerates INV-UILAB-104 recipient Harbor Line as resolvable", () => {
    const detail = getUiLabInvoiceDetail(
      UI_LAB_CORE_COMPANY_ID,
      `ui-lab-inv-${UI_LAB_CORE_COMPANY_ID}-1`,
    );
    assert.ok(detail);
    assert.equal(detail!.referenceCode, "INV-UILAB-104");
    assert.equal(detail!.recipientUserId, "ui-lab-person-harbor");
    assert.ok(getUiLabCustomer360("ui-lab-person-harbor"));
  });
});

describe("final remediation — complete account catalog", () => {
  it("reconciles Bank Home active count with directory and catalog", () => {
    const catalogActive = countUiLabActiveInternalAccounts();
    const directory = getUiLabInternalBankAccountRows();
    const summary = getUiLabInternalBankOpsSummary();
    assert.equal(catalogActive, UI_LAB_INTERNAL_ACCOUNT_IDS.length);
    assert.equal(directory.length, catalogActive);
    assert.equal(summary.totalAccounts, catalogActive);
    assert.ok(catalogActive >= 11, `expected ≥11 active accounts, got ${catalogActive}`);
  });

  it("resolves every catalog account via the detail loader", () => {
    for (const id of UI_LAB_INTERNAL_ACCOUNT_IDS) {
      const detail = getUiLabInternalBankAccountDetail(id);
      assert.ok(detail, `missing detail for ${id}`);
      assert.equal(detail!.status, "Active");
    }
  });

  it("wires Bank Home summary to the UI Lab catalog in UI Lab mode", () => {
    assert.match(read("lib/bank/bank.functions.ts"), /getUiLabInternalBankOpsSummary/);
  });
});

describe("final remediation — UI Lab mutation inventory", () => {
  it("gates platform settings mutations on client and server", () => {
    assert.match(
      read("lib/platform/platform-settings.functions.ts"),
      /assertNotUiLabMutation\("Maintenance mode update"\)/,
    );
    assert.match(
      read("lib/platform/platform-settings.functions.ts"),
      /assertNotUiLabMutation\("Credit Desk status change"\)/,
    );
    assert.match(
      read("lib/platform/platform-settings.functions.ts"),
      /assertNotUiLabMutation\("Commercial plan settings"\)/,
    );
    assert.match(read("components/internal/credit-desk-panel.tsx"), /useUiLabMutationGate/);
    assert.match(
      read("components/internal/credit-desk-panel.tsx"),
      /Unavailable in UI Lab|unavailableLabel/,
    );
    assert.match(
      read("components/internal/maintenance-mode-panel.tsx"),
      /unavailableLabel\("Enable"\)|unavailableLabel\(`Enable/,
    );
    assert.match(read("components/internal/maintenance-mode-panel.tsx"), /Save message/);
    assert.match(
      read("components/internal/commercial-plan-settings-panel.tsx"),
      /useUiLabMutationGate/,
    );
  });
});

describe("final remediation — Exchange redirects and isolation", () => {
  it("redirects Exchange internal routes to Terminal with site=terminal", () => {
    const exchange = read("routes/internal/exchange.tsx");
    assert.match(exchange, /normalizeInternalSearch\(\{ site: "terminal" \}\)/);
    assert.match(exchange, /\/internal\/terminal\/settings/);
    assert.match(exchange, /legacy-host/);
    assert.doesNotMatch(exchange, /to: "\/internal\/inbox\?site=exchange"/);
  });
});

describe("final remediation — responsive list key uniqueness", () => {
  const files = [
    "routes/internal/bank/transactions/index.tsx",
    "routes/internal/bank/accounts/index.tsx",
    "routes/internal/bank/transfers/index.tsx",
    "routes/internal/bank/alta-pay/index.tsx",
    "routes/internal/bank/statements.tsx",
    "routes/internal/users/index.tsx",
    "routes/internal/companies/index.tsx",
    "routes/internal/relationships/index.tsx",
    "routes/internal/lending/loans/index.tsx",
    "routes/internal/alta-card/cards/index.tsx",
    "routes/internal/terminal/investors/index.tsx",
    "routes/internal/terminal/orders/index.tsx",
    "routes/internal/terminal/portfolios/index.tsx",
  ];

  for (const file of files) {
    it(`uses distinct desktop/mobile keys in ${file}`, () => {
      const src = read(file);
      assert.match(src, /desktop-\$/);
      assert.match(src, /mobile-\$/);
    });
  }
});

describe("final remediation — canonical redirect query order", () => {
  it("keeps site first for scheduled transfer redirect", () => {
    const serialized = serializeInternalSearch(
      normalizeInternalSearch({ status: "scheduled", site: "bank" }),
    );
    assert.equal(serialized, "site=bank&status=scheduled");
    assert.ok(!serialized.includes("?"));
  });

  it("wraps internal redirects with normalizeInternalSearch", () => {
    const routesDir = join(root, "routes/internal");
    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(p));
        else if (entry.name.endsWith(".tsx")) out.push(p);
      }
      return out;
    }
    for (const file of walk(routesDir)) {
      const src = readFileSync(file, "utf8");
      if (!src.includes("throw redirect")) continue;
      assert.match(
        src,
        /normalizeInternalSearch/,
        `${file} redirect missing normalizeInternalSearch`,
      );
      assert.doesNotMatch(src, /to: `[^`]*\?[^`]*\?/);
    }
  });
});

describe("final remediation — Jobs naming", () => {
  it("uses Jobs for nav title, H1, breadcrumb, and document title", () => {
    assert.equal(resolveInternalRouteTitle("/internal/jobs"), "Jobs");
    const jobs = read("routes/internal/jobs.tsx");
    assert.match(jobs, /title="Jobs"/);
    assert.match(jobs, /internalDocumentTitle\("Jobs"/);
    assert.doesNotMatch(jobs, /title="System Jobs"/);
    assert.doesNotMatch(jobs, /title="Operations"/);
  });
});

describe("final remediation — mobile contextual navigation", () => {
  it("promotes overflow into a More menu on small screens", () => {
    const nav = read("components/internal/console/internal-contextual-nav.tsx");
    assert.match(nav, /sm:hidden/);
    assert.match(nav, /More/);
    assert.match(nav, /selectThenNavigate/);
    assert.doesNotMatch(nav, /overflow-x-auto/);
    const config = read("components/internal/console/internal-nav-config.ts");
    assert.match(config, /label: "More"/);
  });
});

describe("final remediation — Terminal System deduplication", () => {
  it("has Connection, Readiness, and collapsed Technical details only", () => {
    const page = read("routes/internal/terminal/system.tsx");
    assert.match(page, /Connection/);
    assert.match(page, /Readiness/);
    assert.match(page, /<details/);
    assert.match(page, /Technical details|Technical/);
    assert.doesNotMatch(page, /TerminalEnvironmentBanner/);
  });
});

describe("final remediation — Bank customer Overview ordering", () => {
  it("groups Bank products and collapses Other Alta products", () => {
    const view = read("components/internal/workspace/customer-workspace-view.tsx");
    assert.match(view, /Bank products/);
    assert.match(view, /Other Alta products/);
    assert.match(view, /otherAltaProductsCollapsed|<details/);
    assert.match(view, /Related companies/);
  });
});

describe("final remediation — UI Lab scenario scoping", () => {
  it("hides Bank action scenario on unrelated Corporate system pages", () => {
    const src = read("components/bank/actions/ui-lab-bank-action-scenario-control.tsx");
    assert.match(src, /shouldShowBankActionScenarioControl/);
    assert.match(src, /siteKey === "bank"/);
    assert.match(src, /\/internal\/jobs/);
    assert.match(src, /terminal/);
  });
});

describe("final remediation — search performance instrumentation", () => {
  it("defers audit/job queries and exposes timing helper", () => {
    const svc = read("server/ops-global-search.service.ts");
    assert.match(svc, /wantsSecondary/);
    assert.match(svc, /\[ops-search\]/);
    assert.equal(typeof measureOpsSearchPhaseMs, "function");
    const before = performance.now();
    assert.ok(measureOpsSearchPhaseMs(before) >= 0);
  });

  it("cancels stale client search requests via request id", () => {
    const search = read("components/internal/internal-global-search.tsx");
    assert.match(search, /searchRequestRef/);
    assert.match(search, /requestId === searchRequestRef\.current/);
  });
});

describe("final remediation — site-aware document titles", () => {
  it("uses site-specific suffixes", () => {
    assert.equal(internalDocumentTitleSuffix("bank"), "Alta Bank Internal");
    assert.equal(internalDocumentTitleSuffix("terminal"), "Alta Terminal Internal");
    assert.equal(internalDocumentTitleSuffix("corporate"), "Alta Internal");
    assert.equal(internalDocumentTitle("Jobs", "bank"), "Jobs — Alta Bank Internal");
    assert.equal(internalDocumentTitle("Home", "terminal"), "Home — Alta Terminal Internal");
  });
});

describe("final remediation — party catalog completeness", () => {
  it("lists every resolvable party id", () => {
    const ids = listUiLabResolvablePartyIds();
    assert.ok(ids.includes("ui-lab-person-harbor"));
    assert.ok(ids.includes("ui-lab-person-ava"));
    assert.ok(!ids.includes("ui-lab-person-riley"));
  });
});
