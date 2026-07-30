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
import {
  getUiLabTerminalFundingEligibility,
  mockUiLabTerminalFundingSubmission,
} from "@/lib/terminal/ui-lab/ui-lab-terminal-funding-fixtures";
import { TERMINAL_FUNDING_TSE_DISCLAIMER } from "@/lib/terminal/terminal-funding-types";
import { inboxItemFromException } from "@/lib/internal/inbox-normalize";
import type { ExceptionItem } from "@/lib/internal/ops-types";

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
      "?action=terminal-funding&portfolioId=TP-1&accountId=BA-1",
    );
    assert.equal(parsed.action, "terminal-funding");
    assert.equal(parsed.portfolioId, "TP-1");
    assert.equal(parsed.accountId, "BA-1");

    const merged = mergeBankActionSearch(
      { site: "bank" },
      { action: "terminal-funding", portfolioId: "TP-2" },
    );
    assert.equal(merged.portfolioId, "TP-2");
    assert.equal(merged.action, "terminal-funding");

    const stripped = stripBankActionSearch({
      action: "terminal-funding",
      portfolioId: "TP-2",
      site: "bank",
    });
    assert.equal("portfolioId" in stripped, false);
    assert.equal("action" in stripped, false);
    assert.equal(stripped.site, "bank");
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
          bankAccountId: "BA-LAB-FROZEN",
          portfolioId: "TP-LAB-PERSONAL",
          amount: 10,
        }),
      /frozen/i,
    );
    assert.throws(
      () =>
        mockUiLabTerminalFundingSubmission({
          direction: "BANK_TO_TERMINAL",
          bankAccountId: "BA-LAB-CHECKING",
          portfolioId: "TP-LAB-ARCHIVED",
          amount: 10,
        }),
      /portfolio/i,
    );
  });

  it("rejects insufficient funds in mock submit", () => {
    assert.throws(
      () =>
        mockUiLabTerminalFundingSubmission({
          direction: "BANK_TO_TERMINAL",
          bankAccountId: "BA-LAB-CHECKING",
          portfolioId: "TP-LAB-PERSONAL",
          amount: 999_999,
        }),
      /Insufficient available Bank/i,
    );
    assert.throws(
      () =>
        mockUiLabTerminalFundingSubmission({
          direction: "TERMINAL_TO_BANK",
          bankAccountId: "BA-LAB-CHECKING",
          portfolioId: "TP-LAB-PERSONAL",
          amount: 999_999,
        }),
      /Insufficient Terminal/i,
    );
  });

  it("returns a completed receipt on success", () => {
    const receipt = mockUiLabTerminalFundingSubmission({
      direction: "BANK_TO_TERMINAL",
      bankAccountId: "BA-LAB-CHECKING",
      portfolioId: "TP-LAB-PERSONAL",
      amount: 100,
    });
    assert.equal(receipt.status, "COMPLETED");
    assert.match(receipt.referenceCode, /^TFD-/);
    assert.equal(receipt.amount, 100);
    assert.ok((receipt.resultingBankAvailable ?? 0) < 12_500);
    assert.ok((receipt.resultingTerminalCash ?? 0) > 2_450);
  });
});

describe("terminal funding UI structure", () => {
  it("wires Move money chooser and funding flow", () => {
    const move = read("components/bank/actions/flows/move-money-action-flow.tsx");
    const flow = read("components/bank/actions/flows/terminal-funding-action-flow.tsx");
    const host = read("components/bank/actions/bank-action-host.tsx");
    assert.match(move, /Transfer to or from Alta Terminal/);
    assert.match(move, /TerminalFundingActionFlow/);
    assert.match(flow, /BANK_TO_TERMINAL/);
    assert.match(flow, /TERMINAL_TO_BANK/);
    assert.match(flow, /Confirm transfer/);
    assert.match(flow, /TERMINAL_FUNDING_TSE_DISCLAIMER/);
    assert.match(host, /action === "terminal-funding"/);
  });

  it("keeps honest TSE disclaimer copy", () => {
    assert.match(TERMINAL_FUNDING_TSE_DISCLAIMER, /does not deposit funds into TSE custody/i);
    assert.doesNotMatch(TERMINAL_FUNDING_TSE_DISCLAIMER, /deposit to TSE/i);
  });

  it("preserves site/from on funding workspace and transfers directory", () => {
    const workspace = read(
      "components/internal/workspace/terminal-funding-workspace-view.tsx",
    );
    const directory = read("routes/internal/bank/transfers/index.tsx");
    const route = read("routes/internal/bank/transfers/funding.$transferId.tsx");
    assert.match(workspace, /parseReturnPath/);
    assert.match(workspace, /search\.site/);
    assert.match(directory, /kind:\s*"terminal-funding"/);
    assert.match(directory, /fundingDirection/);
    assert.match(route, /parseTransferRecordSearch/);
  });

  it("routes funding exceptions to the funding record path", () => {
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
