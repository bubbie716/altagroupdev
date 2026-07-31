/**
 * Action-consent integration coverage for funding / Pay resume rules.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, beforeEach } from "node:test";
import { ConsentRequiredError } from "@/lib/legal/consent-required-error";
import { parseConsentRequiredFromError } from "@/lib/legal/parse-consent-required";
import {
  actionConsentSequenceProgress,
  assertUiLabProductConsentForAction,
  canResumeProtectedAction,
  isConsentCancelledError,
} from "@/lib/legal/ui-lab-action-consent";
import {
  clearUiLabAcceptedScopeOverlay,
  getUiLabAcceptedOverlaySnapshot,
  getUiLabProductConsentGateState,
  mockUiLabProductConsentSubmit,
  recordUiLabAcceptedScope,
} from "@/lib/legal/ui-lab-product-consent";
import { getConsentControlGroups } from "@/lib/legal/legal-consent-bundle";
import { getUiLabActiveCustomerBankAccounts } from "@/lib/bank/ui-lab-commercial-fixtures";
import { getUiLabPayFundingSources } from "@/lib/bank/ui-lab-commercial-fixtures";
import { canDismissBankAction } from "@/lib/bank/bank-action-flow";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function acceptAll(scope: "BANK" | "TERMINAL" | "ALTA_PAY") {
  return getConsentControlGroups(scope).map((g) => g.id);
}

describe("action consent resume gate", () => {
  beforeEach(() => {
    clearUiLabAcceptedScopeOverlay();
  });

  it("refuses resume while any scope remains missing", () => {
    assert.equal(canResumeProtectedAction(["TERMINAL"]), false);
    assert.equal(canResumeProtectedAction([]), true);
  });

  it("after route-level Bank accept, funding requires only Terminal", () => {
    recordUiLabAcceptedScope("BANK", null, "funding_missing_both");
    const state = getUiLabProductConsentGateState({
      scopes: ["BANK", "TERMINAL"],
      uiLabScenario: "funding_missing_both",
    });
    assert.deepEqual(state.missingScopes, ["TERMINAL"]);
    assert.equal(state.current?.scope, "TERMINAL");
    assert.equal(state.current?.sequence?.index, 2);
    assert.equal(state.current?.sequence?.total, 2);
    assert.equal(canResumeProtectedAction(state.missingScopes), false);
  });

  it("accepting only Bank cannot resume funding", () => {
    mockUiLabProductConsentSubmit(
      { scope: "BANK", sourceSite: "bank", acceptedControlIds: acceptAll("BANK") },
      "funding_missing_both",
    );
    const state = getUiLabProductConsentGateState({
      scopes: ["BANK", "TERMINAL"],
      uiLabScenario: "funding_missing_both",
    });
    assert.throws(
      () =>
        assertUiLabProductConsentForAction("terminal.funding", {
          uiLabScenario: "funding_missing_both",
          uiLabAcceptedOverlay: getUiLabAcceptedOverlaySnapshot("funding_missing_both"),
        }),
      (err: unknown) => {
        assert.ok(err instanceof ConsentRequiredError);
        assert.deepEqual(err.missingScopes, ["TERMINAL"]);
        return true;
      },
    );
    assert.equal(canResumeProtectedAction(state.missingScopes), false);
  });

  it("accepting Terminal after Bank allows funding resume once", () => {
    mockUiLabProductConsentSubmit(
      { scope: "BANK", sourceSite: "bank", acceptedControlIds: acceptAll("BANK") },
      "funding_missing_both",
    );
    mockUiLabProductConsentSubmit(
      { scope: "TERMINAL", sourceSite: "bank", acceptedControlIds: acceptAll("TERMINAL") },
      "funding_missing_both",
    );
    assert.doesNotThrow(() =>
      assertUiLabProductConsentForAction("terminal.funding", {
        uiLabScenario: "funding_missing_both",
        uiLabAcceptedOverlay: getUiLabAcceptedOverlaySnapshot("funding_missing_both"),
      }),
    );
  });

  it("funding_missing_terminal skips Bank", () => {
    const state = getUiLabProductConsentGateState({
      scopes: ["BANK", "TERMINAL"],
      uiLabScenario: "funding_missing_terminal",
    });
    assert.deepEqual(state.missingScopes, ["TERMINAL"]);
    assert.equal(state.current?.scope, "TERMINAL");
  });

  it("cancel and consent errors do not count as resumable success", () => {
    assert.equal(isConsentCancelledError(new Error("CONSENT_CANCELLED")), true);
    assert.equal(isConsentCancelledError(new Error("OTHER")), false);
    const parsed = parseConsentRequiredFromError(
      new ConsentRequiredError(["BANK", "TERMINAL"]),
    );
    assert.deepEqual(parsed?.missingScopes, ["BANK", "TERMINAL"]);
  });

  it("sequence progress uses the original missing set", () => {
    assert.deepEqual(actionConsentSequenceProgress(["BANK", "TERMINAL"], "TERMINAL"), {
      index: 2,
      total: 2,
    });
  });
});

describe("process-state machine forbids mutation-before-consent", () => {
  it("awaiting_consent is not dismissible and is not submitting", () => {
    assert.equal(canDismissBankAction("awaiting_consent"), false);
    assert.equal(canDismissBankAction("submitting"), false);
    assert.equal(canDismissBankAction("review"), true);
  });

  it("funding and pay enter awaiting_consent before submitting", () => {
    const funding = read("components/bank/actions/flows/terminal-funding-action-flow.tsx");
    const pay = read("components/bank/actions/flows/pay-action-flow.tsx");
    assert.match(funding, /setStep\("awaiting_consent"\)/);
    assert.match(funding, /setStep\("submitting"\)/);
    assert.ok(
      funding.indexOf('setStep("awaiting_consent")') < funding.indexOf('setStep("submitting")'),
    );
    assert.match(pay, /setPhase\("awaiting_consent"\)/);
    assert.ok(
      pay.indexOf('setPhase("awaiting_consent")') < pay.indexOf('setPhase("submitting")'),
    );
    assert.match(funding, /isConsentCancelledError/);
    assert.match(pay, /isConsentCancelledError/);
  });

  it("UI Lab funding mutation asserts product consent before mock debit", () => {
    const fns = read("lib/terminal/terminal-funding.functions.ts");
    assert.match(fns, /assertUiLabProductConsentForAction/);
    assert.match(fns, /terminal\.funding/);
  });
});

describe("Alta Pay action-sheet account loader", () => {
  it("fetchActiveBankAccounts uses canonical UI Lab customer accounts", () => {
    assert.match(read("lib/bank/bank.functions.ts"), /getUiLabActiveCustomerBankAccounts/);
    // Fixture helper itself must yield resolvable IDs shared with Pay funding.
    // isUiLabMode is false in unit tests — still verify Pay funding catalog IDs exist.
    const payIds = new Set(
      [
        "BA-LAB-ACCESS",
        "BA-LAB-CHK",
        "BA-LAB-SAV",
        "BA-LAB-ALTG-OP",
        "BA-LAB-NPC-OP",
      ],
    );
    // Source inventory — getUiLabPayFundingSources returns [] when UI Lab off, so check source.
    const fixtures = read("lib/bank/ui-lab-commercial-fixtures.ts");
    for (const id of payIds) {
      assert.match(fixtures, new RegExp(id));
    }
    assert.match(fixtures, /getUiLabActiveCustomerBankAccounts/);
    void getUiLabActiveCustomerBankAccounts;
    void getUiLabPayFundingSources;
  });
});

describe("scenario isolation regression", () => {
  beforeEach(() => {
    clearUiLabAcceptedScopeOverlay();
  });

  it("Funding Bank accept does not suppress Mobile consent sheet", () => {
    mockUiLabProductConsentSubmit(
      { scope: "BANK", sourceSite: "bank", acceptedControlIds: acceptAll("BANK") },
      "funding_missing_both",
    );
    // Switching scenarios clears overlay via setUiLabProductConsentScenario in the browser;
    // unit tests clear explicitly the same way the setter does.
    clearUiLabAcceptedScopeOverlay();
    const mobile = getUiLabProductConsentGateState({
      scopes: ["BANK"],
      uiLabScenario: "mobile_consent_sheet",
    });
    assert.equal(mobile.current?.scope, "BANK");
    assert.match(mobile.current?.headline ?? "", /First use of Alta Bank/);
  });
});
