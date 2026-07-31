import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { isBankActionId, parseBankActionId } from "@/lib/bank/bank-action-ids";
import {
  mergeBankActionSearch,
  parseBankActionSearch,
  stripBankActionSearch,
} from "@/lib/bank/bank-action-url";
import { isBankActionUiLabScenario } from "@/lib/bank/bank-action-ui-lab";
import { UI_LAB_MOCK_USER } from "@/lib/auth/ui-lab";
import { inboxItemFromException } from "@/lib/internal/inbox-normalize";
import { parseReturnPath } from "@/lib/internal/record-return-context";
import type { ExceptionItem } from "@/lib/internal/ops-types";
import { TERMINAL_FUNDING_TSE_DISCLAIMER } from "@/lib/terminal/terminal-funding-types";
import { resolveTerminalFundingPreselection } from "@/lib/terminal/terminal-funding-preselection";
import {
  UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS,
  UI_LAB_TERMINAL_FUNDING_OWNER_IDS,
  UI_LAB_TERMINAL_FUNDING_TRANSFER_IDS,
  UI_LAB_TERMINAL_PORTFOLIO_IDS,
} from "@/lib/terminal/ui-lab/ui-lab-terminal-canonical-ids";
import {
  assertUiLabTerminalFundingEligibilityScenario,
  getUiLabTerminalFundingEligibility,
  getUiLabTerminalFundingTransfer,
  mockUiLabTerminalFundingSubmission,
} from "@/lib/terminal/ui-lab/ui-lab-terminal-funding-fixtures";
import { mockPortfolioIds } from "@/lib/terminal/ui-lab/ui-lab-terminal-market-fixtures";
import { UI_LAB_TERMINAL_PORTFOLIO_IDS as OPS_PORTFOLIO_IDS } from "@/lib/terminal/ui-lab/ui-lab-terminal-ops-fixtures";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("terminal funding registry and URLs", () => {
  it("registers terminal-funding bank action", () => {
    assert.equal(isBankActionId("terminal-funding"), true);
    assert.equal(parseBankActionId("terminal-funding"), "terminal-funding");
  });

  it("parses and strips portfolioId with action search", () => {
    const parsed = parseBankActionSearch(
      `?action=terminal-funding&portfolioId=${UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore}&accountId=${UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking}`,
    );
    assert.equal(parsed.action, "terminal-funding");
    assert.equal(parsed.portfolioId, UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore);
    assert.equal(parsed.accountId, UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking);

    const merged = mergeBankActionSearch(
      { site: "bank" },
      { action: "terminal-funding", portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury },
    );
    assert.equal(merged.portfolioId, UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury);
    assert.equal(merged.action, "terminal-funding");

    const stripped = stripBankActionSearch({
      action: "terminal-funding",
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury,
      site: "bank",
    });
    assert.equal("portfolioId" in stripped, false);
    assert.equal("action" in stripped, false);
    assert.equal(stripped.site, "bank");
  });
});

describe("canonical UI Lab Terminal funding identity", () => {
  it("aligns customer, funding, and ops portfolio IDs", () => {
    const customer = mockPortfolioIds(UI_LAB_MOCK_USER.id);
    assert.equal(UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore, customer.personalCore);
    assert.equal(UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury, customer.companyAltg);
    assert.equal(OPS_PORTFOLIO_IDS.personalCore, UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore);
    assert.equal(OPS_PORTFOLIO_IDS.companyTreasury, UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury);
    assert.match(UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore, /^tp_ui-lab-user_/);
    assert.doesNotMatch(UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore, /TP-LAB|ui-lab-term-pf/);
  });

  it("uses the same owner and account IDs across eligibility and records", () => {
    const eligibility = getUiLabTerminalFundingEligibility();
    const personal = eligibility.portfolios.find(
      (p) => p.id === UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
    );
    const company = eligibility.portfolios.find(
      (p) => p.id === UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury,
    );
    assert.equal(personal?.ownerUserId, UI_LAB_TERMINAL_FUNDING_OWNER_IDS.userId);
    assert.equal(company?.ownerCompanyId, UI_LAB_TERMINAL_FUNDING_OWNER_IDS.companyId);
    assert.ok(
      eligibility.accounts.some((a) => a.id === UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking),
    );

    const record = getUiLabTerminalFundingTransfer(
      UI_LAB_TERMINAL_FUNDING_TRANSFER_IDS.bankToTerminal,
    );
    assert.equal(record?.portfolioId, UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore);
    assert.equal(record?.bankAccountId, UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking);
  });
});

describe("terminal funding preselection", () => {
  const eligibility = getUiLabTerminalFundingEligibility();

  it("preselections Terminal Home / personal portfolio deep links", () => {
    const resolved = resolveTerminalFundingPreselection(eligibility, {
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
      direction: "BANK_TO_TERMINAL",
    });
    assert.equal(resolved.portfolioId, UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore);
    assert.equal(resolved.bankAccountId, UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking);
    assert.equal(resolved.portfolioPreselected, true);
    assert.equal(resolved.portfolioUnavailable, false);
  });

  it("preselections company portfolios with matching company accounts", () => {
    const resolved = resolveTerminalFundingPreselection(eligibility, {
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury,
      direction: "BANK_TO_TERMINAL",
    });
    assert.equal(resolved.portfolioId, UI_LAB_TERMINAL_PORTFOLIO_IDS.companyTreasury);
    assert.equal(resolved.bankAccountId, UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.companyOperating);
    assert.equal(resolved.portfolioPreselected, true);
  });

  it("surfaces unavailable/ineligible portfolios without orphan Select values", () => {
    const unknown = resolveTerminalFundingPreselection(eligibility, {
      portfolioId: "tp_missing_portfolio",
      direction: "BANK_TO_TERMINAL",
    });
    assert.equal(unknown.portfolioUnavailable, true);
    assert.match(unknown.portfolioUnavailableReason ?? "", /unavailable/i);
    assert.ok(eligibility.portfolios.some((p) => p.id === unknown.portfolioId && p.canFund));
    assert.ok(eligibility.accounts.some((a) => a.id === unknown.bankAccountId));

    const archived = resolveTerminalFundingPreselection(eligibility, {
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.archived,
      direction: "TERMINAL_TO_BANK",
    });
    assert.equal(archived.portfolioUnavailable, true);
    assert.notEqual(archived.portfolioId, UI_LAB_TERMINAL_PORTFOLIO_IDS.archived);
    assert.match(archived.portfolioUnavailableReason ?? "", /archived|cannot/i);
  });

  it("keeps a deep-linked portfolio when a mismatched account is supplied", () => {
    const resolved = resolveTerminalFundingPreselection(eligibility, {
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
      bankAccountId: UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.companyOperating,
      direction: "BANK_TO_TERMINAL",
    });
    assert.equal(resolved.portfolioId, UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore);
    assert.equal(resolved.bankAccountId, UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking);
  });

  it("works for both funding directions", () => {
    for (const direction of ["BANK_TO_TERMINAL", "TERMINAL_TO_BANK"] as const) {
      const resolved = resolveTerminalFundingPreselection(eligibility, {
        portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
        direction,
      });
      assert.equal(resolved.portfolioId, UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore);
      assert.ok(resolved.bankAccountId);
    }
  });
});

describe("terminal funding UI Lab fixtures", () => {
  it("exposes personal and company eligibility", () => {
    const eligibility = getUiLabTerminalFundingEligibility();
    assert.ok(eligibility.accounts.some((a) => a.ownershipType === "PERSONAL" && a.canDebit));
    assert.ok(eligibility.accounts.some((a) => a.ownershipType === "COMPANY"));
    assert.ok(eligibility.portfolios.some((p) => p.ownerType === "personal" && p.canFund));
    assert.ok(eligibility.portfolios.some((p) => !p.canFund));
  });

  it("rejects frozen account and archived portfolio in mock submit", () => {
    assert.throws(
      () =>
        mockUiLabTerminalFundingSubmission({
          direction: "BANK_TO_TERMINAL",
          bankAccountId: UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.frozenReserve,
          portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
          amount: 10,
          idempotencyKey: "k-frozen",
        }),
      /frozen/i,
    );
    assert.throws(
      () =>
        mockUiLabTerminalFundingSubmission({
          direction: "BANK_TO_TERMINAL",
          bankAccountId: UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking,
          portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.archived,
          amount: 10,
          idempotencyKey: "k-archived",
        }),
      /portfolio/i,
    );
  });

  it("rejects insufficient funds in mock submit", () => {
    assert.throws(
      () =>
        mockUiLabTerminalFundingSubmission({
          direction: "BANK_TO_TERMINAL",
          bankAccountId: UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking,
          portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
          amount: 999_999,
          idempotencyKey: "k-bank-funds",
        }),
      /Insufficient available Bank/i,
    );
    assert.throws(
      () =>
        mockUiLabTerminalFundingSubmission({
          direction: "TERMINAL_TO_BANK",
          bankAccountId: UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking,
          portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
          amount: 999_999,
          idempotencyKey: "k-term-funds",
        }),
      /Insufficient Terminal/i,
    );
  });

  it("returns a completed receipt on Bank → Terminal success", () => {
    const receipt = mockUiLabTerminalFundingSubmission({
      direction: "BANK_TO_TERMINAL",
      bankAccountId: UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking,
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
      amount: 100,
      idempotencyKey: "k-success-b2t",
    });
    assert.equal(receipt.status, "COMPLETED");
    assert.match(receipt.referenceCode, /^TFD-/);
    assert.equal(receipt.amount, 100);
    assert.ok((receipt.resultingBankAvailable ?? 0) < 38_214.2);
    assert.ok((receipt.resultingTerminalCash ?? 0) > 2_450);
  });

  it("returns a completed receipt on Terminal → Bank success", () => {
    const receipt = mockUiLabTerminalFundingSubmission({
      direction: "TERMINAL_TO_BANK",
      bankAccountId: UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking,
      portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
      amount: 50,
      idempotencyKey: "k-success-t2b",
    });
    assert.equal(receipt.status, "COMPLETED");
    assert.equal(receipt.direction, "TERMINAL_TO_BANK");
    assert.ok((receipt.resultingBankAvailable ?? 0) > 38_214.2);
    assert.ok((receipt.resultingTerminalCash ?? 0) < 2_450);
  });

  it("keeps server_error submission-only and separates eligibility_error", () => {
    assert.equal(isBankActionUiLabScenario("eligibility_error"), true);
    assert.equal(isBankActionUiLabScenario("server_error"), true);
    assert.throws(
      () => assertUiLabTerminalFundingEligibilityScenario("eligibility_error"),
      /Unable to load funding/i,
    );
    assert.doesNotThrow(() => assertUiLabTerminalFundingEligibilityScenario("server_error"));
    assert.throws(
      () =>
        mockUiLabTerminalFundingSubmission(
          {
            direction: "BANK_TO_TERMINAL",
            bankAccountId: UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS.personalChecking,
            portfolioId: UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore,
            amount: 25,
            idempotencyKey: "k-server-error",
          },
          "server_error",
        ),
      /Temporary server issue/i,
    );
  });
});

describe("terminal funding UI structure", () => {
  it("wires Move money chooser and funding flow", () => {
    const chooser = read("components/bank/move-money-chooser.tsx");
    const move = read("components/bank/actions/flows/move-money-action-flow.tsx");
    const flow = read("components/bank/actions/flows/terminal-funding-action-flow.tsx");
    const host = read("components/bank/actions/bank-action-host.tsx");
    assert.match(chooser, /launch\("terminal-funding"\)/);
    assert.match(chooser, /Alta Terminal/);
    assert.match(move, /Transfer to or from Alta Terminal/);
    assert.match(move, /TerminalFundingActionFlow/);
    assert.match(flow, /BANK_TO_TERMINAL/);
    assert.match(flow, /TERMINAL_TO_BANK/);
    assert.match(flow, /Confirm transfer/);
    assert.match(flow, /TERMINAL_FUNDING_TSE_DISCLAIMER/);
    assert.match(flow, /resolveTerminalFundingPreselection/);
    assert.match(flow, /uiLabScenario/);
    assert.match(flow, /Try again/);
    assert.match(flow, /Unable to load funding options/);
    assert.match(flow, /portfolioFirst/);
    assert.match(flow, /TERMINAL_TO_BANK/);
    assert.match(host, /action === "terminal-funding"/);
  });

  it("keeps honest TSE disclaimer copy", () => {
    assert.match(TERMINAL_FUNDING_TSE_DISCLAIMER, /does not deposit funds into TSE custody/i);
    assert.doesNotMatch(TERMINAL_FUNDING_TSE_DISCLAIMER, /deposit to TSE/i);
  });

  it("deep-links Terminal Home and portfolio detail with exact portfolio IDs", () => {
    const home = read("routes/terminal/index.tsx");
    const detail = read("routes/terminal/portfolio/$portfolioId.tsx");
    assert.match(home, /action:\s*"terminal-funding"/);
    assert.match(home, /portfolioId:\s*portfolios\[0\]\.id/);
    assert.match(detail, /action:\s*"terminal-funding"/);
    assert.match(detail, /portfolioId:\s*selectedPortfolio\.id/);
  });

  it("preserves site/from on Bank funding workspace and transfers directory", () => {
    const workspace = read("components/internal/workspace/terminal-funding-workspace-view.tsx");
    const directory = read("routes/internal/bank/transfers/index.tsx");
    const route = read("routes/internal/bank/transfers/funding.$transferId.tsx");
    assert.match(workspace, /parseReturnPath/);
    assert.match(workspace, /search\.site/);
    assert.match(workspace, /presentation/);
    assert.match(directory, /kind:\s*"terminal-funding"/);
    assert.match(directory, /fundingDirection/);
    assert.match(route, /parseTransferRecordSearch/);
  });

  it("adds Terminal-safe funding route with redaction and no Corporate fallback", () => {
    const route = read("routes/internal/terminal/funding/$transferId.tsx");
    const fns = read("lib/terminal/terminal-funding.functions.ts");
    const portfolio = read("components/internal/workspace/terminal-portfolio-workspace-view.tsx");
    const workspace = read("components/internal/workspace/terminal-funding-workspace-view.tsx");
    assert.match(route, /fetchTerminalSafeFundingTransfer/);
    assert.match(route, /presentation="terminal"/);
    assert.match(fns, /requireTerminalAdmin/);
    assert.match(fns, /maskBankForTerminalStaff:\s*true/);
    assert.match(fns, /bankTransactionId:\s*null/);
    assert.match(portfolio, /\/internal\/terminal\/funding\/\$transferId/);
    assert.doesNotMatch(
      portfolio,
      /to="\/internal\/bank\/transfers\/funding\/\$transferId"/,
    );
    assert.match(workspace, /presentation === "terminal"/);
    assert.match(workspace, /Bank \$\{transfer\.bankAccountMasked\}/);
    assert.match(workspace, /!terminalMode \? \(/);
    assert.match(workspace, /Related records/);
    assert.match(workspace, /Technical details/);
  });

  it("removes duplicate Transfers breadcrumb while keeping filtered return path", () => {
    const page = read("components/internal/workspace/record-workspace-page.tsx");
    const workspace = read("components/internal/workspace/terminal-funding-workspace-view.tsx");
    assert.match(page, /\/internal\/bank\/transfers/);
    assert.match(page, /breadcrumbs\.slice\(-1\)/);
    assert.match(workspace, /kind:\s*"terminal-funding"/);
    const transfers = [...workspace.matchAll(/label:\s*"Transfers"/g)];
    assert.equal(transfers.length, 1);
  });

  it("labels Terminal portfolio return paths for Back chrome", () => {
    const parsed = parseReturnPath(
      `/internal/terminal/portfolios/${UI_LAB_TERMINAL_PORTFOLIO_IDS.personalCore}?tab=overview&site=terminal`,
    );
    assert.ok(parsed);
    assert.equal(parsed!.label, "Portfolio");
    assert.equal(parsed!.search.site, "terminal");
  });

  it("routes funding exceptions to the Bank funding record path", () => {
    const item = inboxItemFromException({
      id: "tfd-abc",
      category: "failed_transfer",
      severity: "high",
      title: "Terminal funding · TFD-1",
      detail: "failed",
      href: "/internal/bank/transfers/funding/abc",
      createdAt: new Date().toISOString(),
    } satisfies ExceptionItem);
    assert.ok(item);
    assert.equal(item!.destination?.to, "/internal/bank/transfers/funding/$transferId");
    assert.equal(item!.destination?.params?.transferId, "abc");
  });
});
