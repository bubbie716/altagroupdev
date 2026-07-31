import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  accountNeedsDirectoryAttention,
  sortAccountsForDirectory,
  transactionDirectionWord,
  transactionReviewCta,
  MONEY_LIST_PAGE_SIZE,
} from "@/lib/internal/money-desk";
import {
  TRANSFER_ACTION_LABELS,
  primaryTransferAttentionActions,
  transferMatchesListFilter,
  transferReviewCta,
} from "@/lib/internal/transfer-record-copy";
import { getUiLabTransactionExplorer } from "@/lib/bank/ui-lab-money-ops-fixtures";
import { assertEntityInternalRouteAccess } from "@/lib/internal/entity-internal-scope";
import type { AltaUser } from "@/lib/auth/types";
import type { InternalBankAccountRow } from "@/lib/bank/backend-types";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function account(
  partial: Partial<InternalBankAccountRow> & Pick<InternalBankAccountRow, "id" | "accountName" | "status">,
): InternalBankAccountRow {
  return {
    accountNumber: "AB-1",
    holder: "Owner",
    product: "Checking",
    balance: "ƒ1.00",
    companyName: null,
    createdAt: "2026-01-01",
    lastActivityAt: "2026-07-01",
    ...partial,
  };
}

function userWithTags(tags: AltaUser["tags"]): AltaUser {
  return {
    id: "u1",
    discordId: "1",
    discordUsername: "tester",
    avatarUrl: null,
    email: null,
    minecraftUsername: null,
    minecraftUuid: null,
    minecraftVerifiedAt: null,
    eligibilityConfirmedAt: null,
    coreOnboardingCompletedAt: null,
    onboardingCompletedAt: null,
    tags,
    accountStatus: "active",
    internalAccess: true,
    companyMemberships: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

describe("phase6: Account directory", () => {
  it("uses desktop fields and mobile Review account cards", () => {
    const src = read("routes/internal/bank/accounts/index.tsx");
    assert.match(src, /title="Accounts"/);
    assert.match(src, /Last activity/);
    assert.match(src, /Review account/);
    assert.match(src, /md:hidden/);
    assert.match(src, /onClear/);
    assert.match(src, /buildListReturnPath/);
    assert.match(src, /withInternalSiteSearch/);
    assert.doesNotMatch(src, /AdminDataTable/);
    assert.doesNotMatch(src, />\s*Open\s*</);
    assert.doesNotMatch(src, />\s*Manage\s*</);
  });

  it("sorts attention accounts first", () => {
    const sorted = sortAccountsForDirectory([
      account({ id: "1", accountName: "Active", status: "Active" }),
      account({ id: "2", accountName: "Frozen", status: "Frozen", lastActivityAt: "2026-06-01" }),
    ]);
    assert.equal(sorted[0]!.id, "2");
    assert.ok(accountNeedsDirectoryAttention(sorted[0]!));
  });
});

describe("phase6: Transaction directory", () => {
  it("titles page Transactions with pagination and pending CTAs", () => {
    const src = read("routes/internal/bank/transactions/index.tsx");
    assert.match(src, /title="Transactions"/);
    assert.doesNotMatch(src, /Transaction Explorer/);
    assert.match(src, /offset/);
    assert.match(src, /Previous/);
    assert.match(src, /Next/);
    assert.match(src, /transactionReviewCta/);
    assert.match(src, /Party \/ account/);
    assert.match(src, /onClear/);
    assert.match(src, /OpsCsvExportButton/);
    assert.doesNotMatch(src, /Refine search to narrow/);
    assert.doesNotMatch(src, />\s*Open\s*</);
  });

  it("paginates UI Lab fixtures and sorts pending first", () => {
    const page = getUiLabTransactionExplorer({ limit: MONEY_LIST_PAGE_SIZE, offset: 0 });
    assert.equal(page.items.length, MONEY_LIST_PAGE_SIZE);
    assert.ok(page.hasMore);
    assert.ok(page.total >= 50);
    assert.equal(page.items[0]!.status, "PENDING");
    const page2 = getUiLabTransactionExplorer({ limit: MONEY_LIST_PAGE_SIZE, offset: MONEY_LIST_PAGE_SIZE });
    assert.ok(page2.items.length > 0);
    assert.notEqual(page2.items[0]!.id, page.items[0]!.id);
  });

  it("labels pending deposit and withdrawal review CTAs", () => {
    assert.equal(transactionReviewCta({ status: "PENDING", type: "DEPOSIT" }), "Review deposit");
    assert.equal(transactionReviewCta({ status: "PENDING", type: "WITHDRAWAL" }), "Review withdrawal");
    assert.equal(transactionReviewCta({ status: "APPROVED", type: "DEPOSIT" }), "Review transaction");
    assert.equal(transactionDirectionWord("WITHDRAWAL"), "Out");
    assert.equal(transactionDirectionWord("DEPOSIT"), "In");
  });
});

describe("phase6: Transaction record", () => {
  it("deduplicates pending decision actions and inbox return", () => {
    const view = read("components/internal/workspace/transaction-workspace-view.tsx");
    const actions = read("components/internal/transaction-workspace-actions.tsx");
    assert.match(view, /hasActions && !isPending/);
    assert.match(view, /Return to Inbox/);
    assert.doesNotMatch(view, /Open Inbox money cases/);
    assert.doesNotMatch(actions, /Open inbox/);
  });
});

describe("phase6: Transfers", () => {
  it("keeps one CTA per attention condition and descriptive review links", () => {
    const src = read("routes/internal/bank/transfers/index.tsx");
    const copy = read("lib/internal/transfer-record-copy.ts");
    assert.match(src, /Review failed transfers/);
    assert.match(src, /Open Inbox/);
    assert.doesNotMatch(src, /View failed/);
    assert.match(copy, /"paused"/);
    assert.match(copy, /"active"/);
    assert.match(copy, /"scheduled"/);
  });

  it("separates scheduled type from active status", () => {
    assert.equal(
      transferMatchesListFilter(
        {
          status: "approved",
          paymentType: "immediate",
        } as never,
        "scheduled",
      ),
      false,
    );
    assert.equal(transferReviewCta({ status: "failed", consecutiveFailures: 0 }), "Review failed transfer");
  });

  it("deduplicates transfer record actions with explicit labels", () => {
    const src = read("components/internal/workspace/scheduled-transfer-workspace-view.tsx");
    assert.match(src, /primaryTransferAttentionActions/);
    assert.match(src, /TRANSFER_ACTION_LABELS/);
    assert.equal(TRANSFER_ACTION_LABELS.run_now, "Run transfer now");
    assert.equal(TRANSFER_ACTION_LABELS.cancel, "Cancel transfer");
    assert.deepEqual(primaryTransferAttentionActions({ status: "failed", consecutiveFailures: 0 }), [
      "run_now",
      "cancel",
    ]);
  });

  it("redirects legacy scheduled route without loops", () => {
    const scheduled = read("routes/internal/bank/scheduled.tsx");
    assert.match(scheduled, /redirect/);
    assert.match(scheduled, /to:\s*"\/internal\/bank\/transfers"/);
    assert.match(scheduled, /status:\s*"scheduled"/);
  });
});

describe("phase6: Alta Pay", () => {
  it("uses Payments / Invoices / Payment links views with pagination", () => {
    const src = read("routes/internal/bank/alta-pay/index.tsx");
    assert.match(src, /Payments/);
    assert.match(src, /Invoices/);
    assert.match(src, /Payment links/);
    assert.match(src, /view/);
    assert.match(src, /offset/);
    assert.match(src, /Review payment/);
    assert.match(src, /Review invoice/);
    assert.match(src, /Review payment link/);
    assert.match(src, /search\.q|search\.ref|deps\.ref/);
    assert.doesNotMatch(src, />\s*Open\s*</);
  });

  it("guards nullable payment-link description in search filter", () => {
    const src = read("lib/internal/ops-platform.functions.ts");
    assert.match(src, /\(r\.description \?\? ""\)\.toLowerCase/);
  });
});

describe("phase6: Money navigation", () => {
  it("closes Operations overflow before navigation", () => {
    const nav = read("components/internal/console/internal-contextual-nav.tsx");
    assert.match(nav, /selectThenNavigate/);
    assert.match(nav, /ContextualNavOverflow|Operations|More/);
    const config = read("components/internal/console/internal-nav-config.ts");
    assert.match(config, /Alta Pay/);
    assert.match(config, /Statements/);
    assert.match(config, /Interest/);
    assert.doesNotMatch(config, /Scheduled transfers/);
  });
});

describe("phase6: Scope isolation", () => {
  it("keeps Terminal away from bank money routes", () => {
    const terminalOnly = userWithTags(["terminal_operator"]);
    assert.throws(() => assertEntityInternalRouteAccess("terminal", "/internal/bank/accounts", terminalOnly));
  });

  it("allows bank operators on money routes", () => {
    const bank = userWithTags(["bank_operator"]);
    assert.doesNotThrow(() => assertEntityInternalRouteAccess("bank", "/internal/bank/accounts", bank));
  });
});
