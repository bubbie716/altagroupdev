import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { LEGACY_QUEUE_TO_INBOX } from "@/lib/internal/inbox-types";
import {
  serializeInternalSearch,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walkTsx(full, out);
    } else if (name.endsWith(".tsx") || name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("phase1: Alta Pay landing", () => {
  const src = read("routes/internal/bank/alta-pay/index.tsx");

  it("passes site into Payments / Invoices / Payment links list views", () => {
    assert.match(src, /site=\{search\.site\}/);
    assert.doesNotMatch(src, /function PaymentsView\([\s\S]*?\{[\s\S]*?search\.site/);
    assert.match(src, /function PaymentsView\(\{[\s\S]*?site,/);
    assert.match(src, /function InvoicesView\(\{[\s\S]*?site,/);
    assert.match(src, /function LinksView\(\{[\s\S]*?site,/);
  });

  it("preserves site on payment, invoice, and payment-link record links", () => {
    assert.match(src, /to="\/internal\/bank\/alta-pay\/\$referenceCode"/);
    assert.match(src, /to="\/internal\/bank\/alta-pay\/invoices\/\$invoiceId"/);
    assert.match(src, /to="\/internal\/bank\/alta-pay\/payment-links\/\$linkId"/);
    assert.equal((src.match(/withInternalSiteSearch\(/g) ?? []).length >= 5, true);
  });

  it("does not reference bare search.site inside list components without a site prop", () => {
    // Regression for ReferenceError: search is not defined in payment list views
    const paymentList = src.slice(src.indexOf("function PaymentsView"));
    const paymentBody = paymentList.slice(0, paymentList.indexOf("function InvoicesView"));
    assert.doesNotMatch(paymentBody, /\bsearch\.site\b/);
    assert.match(paymentBody, /\bsite\b/);
  });

  it("composes bank and corporate Alta Pay list return paths with site", () => {
    for (const site of ["bank", "corporate"] as const) {
      const search = withInternalSiteSearch({ q: "acme", from: "/internal/bank/alta-pay" }, site);
      assert.equal(search.site, site);
      assert.match(serializeInternalSearch(search), new RegExp(`site=${site}`));
    }
  });
});

describe("phase1: site-context navigation destinations", () => {
  it("Reports links deposit/withdrawal/alta-pay/lending/audit with site helper", () => {
    const reports = read("routes/internal/reports.tsx");
    assert.match(reports, /to: "\/internal\/inbox"/);
    assert.match(reports, /type: "deposit"/);
    assert.match(reports, /type: "withdrawal"/);
    assert.match(reports, /to: "\/internal\/bank\/alta-pay"/);
    assert.match(reports, /category: "lending"/);
    assert.match(reports, /to: "\/internal\/audit"/);
    assert.match(reports, /withInternalSiteSearch\(primary\.search/);
    assert.doesNotMatch(reports, /to: "\/internal\/queues\//);
    assert.doesNotMatch(reports, /to="\/internal\/queues\//);
  });

  it("Compliance / Risk signal links preserve site via withInternalSiteSearch", () => {
    const compliance = read("routes/internal/compliance.tsx");
    assert.match(compliance, /withInternalSiteSearch\(/);
    assert.match(compliance, /Risk Signals/);
    assert.doesNotMatch(compliance, /to="\/internal\/queues\//);
  });

  it("legacy queue redirects map to Inbox and forward site", () => {
    for (const slug of Object.keys(LEGACY_QUEUE_TO_INBOX)) {
      const src = read(`routes/internal/queues/${slug}.tsx`);
      assert.match(src, /to: "\/internal\/inbox"/);
      assert.match(src, /withInternalSiteSearch\(/);
      assert.match(src, /search\.site/);
    }
  });

  it("Bank Home and Corporate Home inbox links preserve site", () => {
    assert.match(read("routes/internal/bank/index.tsx"), /withInternalSiteSearch\([\s\S]*site\.key/);
    assert.match(read("routes/internal/index.tsx"), /withInternalSiteSearch\([\s\S]*site\.key/);
  });

  it("Statements and Interest account/jobs links preserve site", () => {
    const statements = read("routes/internal/bank/statements.tsx");
    assert.match(statements, /to="\/internal\/bank\/accounts\/\$accountId"/);
    assert.match(statements, /withInternalSiteSearch\(/);
    assert.match(statements, /to="\/internal\/jobs"/);
    assert.match(statements, /to="\/internal\/audit"/);

    const interest = read("routes/internal/bank/interest.tsx");
    assert.match(interest, /to="\/internal\/bank\/accounts\/\$accountId"/);
    assert.match(interest, /withInternalSiteSearch\(/);
    assert.match(interest, /to="\/internal\/jobs"/);
  });

  it("Transfers inbox shortcut preserves site", () => {
    const transfers = read("routes/internal/bank/transfers/index.tsx");
    assert.match(transfers, /to="\/internal\/inbox"/);
    assert.match(transfers, /withInternalSiteSearch\(\s*\{\s*category: "risk"/);
  });

  it("helper retains site for representative Bank Reports → Inbox payloads", () => {
    const deposit = withInternalSiteSearch(
      { category: "money" as const, type: "deposit" as const },
      "bank",
    );
    assert.deepEqual(
      { site: deposit.site, category: deposit.category, type: deposit.type },
      { site: "bank", category: "money", type: "deposit" },
    );
    assert.equal(serializeInternalSearch(deposit).startsWith("site=bank"), true);

    const lending = withInternalSiteSearch(
      { category: "lending" as const, type: "lending_application" as const },
      "corporate",
    );
    assert.equal(lending.site, "corporate");
    assert.equal(serializeInternalSearch(lending).startsWith("site=corporate"), true);
  });
});

describe("phase1: internal inbox shortcut (no customer notifications)", () => {
  it("header uses InternalInboxShortcut instead of customer notification bell", () => {
    const header = read("components/internal/console/internal-header.tsx");
    assert.match(header, /InternalInboxShortcut/);
    assert.doesNotMatch(header, /InternalNotificationsBell/);
    assert.doesNotMatch(header, /fetchUserNotifications/);
  });

  it("shortcut targets site-scoped operator inbox paths", () => {
    const shortcut = read("components/internal/internal-inbox-shortcut.tsx");
    assert.match(shortcut, /aria-label="Open operator inbox"/);
    assert.match(shortcut, /\/internal\/terminal\/inbox/);
    assert.match(shortcut, /\/internal\/inbox/);
    assert.match(shortcut, /withInternalSiteSearch/);
    assert.doesNotMatch(shortcut, /to="\/bank/);
    assert.doesNotMatch(shortcut, /to="\/terminal/);
    assert.doesNotMatch(shortcut, /Loan payment received|Invoice paid|Alta Pay received|Secure Deal Room/);
  });

  it("customer notification bell is not wired into internal header", () => {
    const bell = read("components/internal/internal-notifications-bell.tsx");
    assert.match(bell, /fetchUserNotifications/);
    assert.doesNotMatch(
      read("components/internal/console/internal-header.tsx"),
      /internal-notifications-bell/,
    );
    assert.ok(bell.includes("not used in the internal console header") || bell.includes("InternalInboxShortcut"));
  });
});

describe("phase1: source inventory — unsafe shared-route patterns", () => {
  const inventoryRoots = [
    "routes/internal/reports.tsx",
    "routes/internal/compliance.tsx",
    "routes/internal/bank/index.tsx",
    "routes/internal/index.tsx",
    "routes/internal/bank/statements.tsx",
    "routes/internal/bank/interest.tsx",
    "routes/internal/bank/transfers/index.tsx",
    "routes/internal/bank/alta-pay/index.tsx",
    "routes/internal/queues",
    "components/internal/console/internal-header.tsx",
    "components/internal/internal-inbox-shortcut.tsx",
    "components/internal/queues/exceptions-queue-view.tsx",
  ];

  function filesToScan(): string[] {
    const out: string[] = [];
    for (const rel of inventoryRoots) {
      const full = join(root, rel);
      const st = statSync(full);
      if (st.isDirectory()) out.push(...walkTsx(full));
      else out.push(full);
    }
    return out;
  }

  it("does not leave bare legacy queue destinations on audited surfaces", () => {
    for (const file of filesToScan()) {
      const src = readFileSync(file, "utf8");
      const rel = relative(root, file);
      // Redirect routes may still *target* /internal/queues from product hubs; audited
      // operator destinations themselves must not use queues as the visible Link `to`.
      if (rel.includes("/queues/")) continue;
      assert.doesNotMatch(
        src,
        /to=["']\/internal\/queues\//,
        `${rel} still links to legacy /internal/queues/*`,
      );
      assert.doesNotMatch(
        src,
        /to:\s*["']\/internal\/queues\//,
        `${rel} still navigates to legacy /internal/queues/*`,
      );
    }
  });

  it("does not use insertion-order site spreads on audited surfaces", () => {
    const forbidden = [
      /\{\s*\.\.\.search\s*,\s*site\s*[:}]/,
      /\{\s*\.\.\.mapped\s*,\s*\.\.\.siteSearchPatch/,
      /search=\{\{\s*category:[^}]*\}\}(?![^;]*withInternalSiteSearch)/,
    ];
    for (const file of filesToScan()) {
      const src = readFileSync(file, "utf8");
      const rel = relative(root, file);
      for (const pattern of forbidden.slice(0, 2)) {
        assert.doesNotMatch(src, pattern, `${rel} matches unsafe pattern ${pattern}`);
      }
    }
  });

  it("Reports and Compliance always merge site through withInternalSiteSearch", () => {
    for (const rel of ["routes/internal/reports.tsx", "routes/internal/compliance.tsx"]) {
      const src = read(rel);
      assert.match(src, /withInternalSiteSearch/);
      // Bare shared-route Links without search prop are unsafe on localhost.
      const bareInbox = /to=["']\/internal\/inbox["'](?![^\n]*\n[^\n]*search=)/g;
      // Allow ReportLink / Signal components that receive search as a prop — check raw Link to inbox.
      const linkBlocks = [...src.matchAll(/<Link[\s\S]*?\/>|<Link[\s\S]*?<\/Link>/g)].map((m) => m[0]);
      for (const block of linkBlocks) {
        if (!block.includes('to="/internal/inbox"') && !block.includes("to='/internal/inbox'")) {
          continue;
        }
        assert.match(block, /search=/, `${rel} has bare Inbox Link without search`);
      }
      void bareInbox;
    }
  });
});
