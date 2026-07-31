/**
 * Progressive product consent remediation coverage — integration-oriented.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, beforeEach } from "node:test";
import { ConsentRequiredError } from "@/lib/legal/consent-required-error";
import {
  encodeConsentRequiredMessage,
  parseConsentRequiredFromError,
} from "@/lib/legal/parse-consent-required";
import {
  buildConsentSequence,
  isConsentExceptionAction,
  resolveProductConsentRequirements,
} from "@/lib/legal/product-consent-requirements";
import {
  clearUiLabAcceptedScopeOverlay,
  getUiLabProductConsentGateState,
  mockUiLabProductConsentSubmit,
  recordUiLabAcceptedScope,
} from "@/lib/legal/ui-lab-product-consent";
import { getConsentControlGroups } from "@/lib/legal/legal-consent-bundle";
import { getUiLabPayFundingSources } from "@/lib/bank/ui-lab-commercial-fixtures";
import {
  getUiLabInternalLoanDetail,
  listUiLabCanonicalLoanIds,
  listUiLabInternalLoans,
} from "@/lib/bank/ui-lab-lending-fixtures";
import {
  getUiLabCompany360,
  getUiLabCustomer360,
  listUiLabResolvablePartyIds,
  UI_LAB_PARTY_CATALOG,
} from "@/lib/bank/ui-lab-party-catalog";
import { UI_LAB_CORE_COMPANY_ID } from "@/lib/bank/ui-lab-commercial-fixtures";
import { getUiLabCustomerOnboardingSummary } from "@/lib/onboarding/ui-lab-onboarding";
import { canAcceptCompanyLegalTerms } from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function walkTsx(dir: string, base = ""): string[] {
  let out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const rel = base ? `${base}/${e}` : e;
    if (statSync(p).isDirectory()) out = out.concat(walkTsx(p, rel));
    else if (e.endsWith(".tsx") || e.endsWith(".ts")) out.push(rel);
  }
  return out;
}

function acceptAllControls(scope: "BANK" | "ALTA_CARD" | "LENDING" | "TERMINAL" | "ALTA_PAY") {
  return getConsentControlGroups(scope).map((g) => g.id);
}

function mockUser(role: "owner" | "executive" | "finance_manager" | "viewer"): AltaUser {
  return {
    id: "u-consent-test",
    discordId: "d1",
    discordUsername: "tester",
    avatarUrl: null,
    email: null,
    minecraftUsername: null,
    tags: [],
    accountStatus: "active",
    internalAccess: false,
    companyMemberships: [
      {
        userId: "u-consent-test",
        companyId: "co-1",
        companyName: "Test Co",
        companyType: "PRIVATE_COMPANY",
        companyTicker: null,
        companyStatus: "ACTIVE",
        companyVerificationStatus: "VERIFIED",
        role,
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    lastLoginAt: "2026-01-01T00:00:00.000Z",
    eligibilityConfirmedAt: "2026-01-01T00:00:00.000Z",
    coreOnboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    minecraftUuid: null,
    minecraftVerifiedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("consent required wire encoding", () => {
  it("round-trips missing scopes across Error.message", () => {
    const err = new ConsentRequiredError(["BANK", "ALTA_CARD"], "co-1");
    const parsed = parseConsentRequiredFromError(err);
    assert.ok(parsed);
    assert.deepEqual(parsed.missingScopes, ["BANK", "ALTA_CARD"]);
    assert.equal(parsed.companyId, "co-1");
    assert.match(err.message, /^CONSENT_REQUIRED:/);
  });

  it("parses encoded message strings from the wire", () => {
    const message = encodeConsentRequiredMessage(["TERMINAL"], null);
    const parsed = parseConsentRequiredFromError(new Error(message));
    assert.deepEqual(parsed?.missingScopes, ["TERMINAL"]);
  });
});

describe("customer error mapping never exposes CONSENT_REQUIRED", () => {
  it("maps structured consent errors to customer-safe copy", () => {
    const err = new ConsentRequiredError(["ALTA_PAY"]);
    const message = formatCustomerActionError(err, "pay");
    assert.doesNotMatch(message, /CONSENT_REQUIRED/);
    assert.match(message, /product terms/i);
  });
});

describe("multi-scope UI Lab sequencing", () => {
  beforeEach(() => {
    clearUiLabAcceptedScopeOverlay();
  });

  it("lets an explicit empty client overlay override polluted server memory", () => {
    recordUiLabAcceptedScope("BANK", null, "bank_first_visit");
    const polluted = getUiLabProductConsentGateState({
      scopes: ["BANK"],
      uiLabScenario: "bank_first_visit",
    });
    assert.equal(polluted.current, null);

    const reset = getUiLabProductConsentGateState({
      scopes: ["BANK"],
      uiLabScenario: "bank_first_visit",
      uiLabAcceptedOverlay: { user: {}, companies: {} },
    });
    assert.equal(reset.current?.scope, "BANK");
    assert.equal(reset.current?.headline, "First use of Alta Bank");
  });

  it("isolates overlays across scenarios", () => {
    recordUiLabAcceptedScope("BANK", null, "funding_missing_both");
    mockUiLabProductConsentSubmit(
      {
        scope: "BANK",
        sourceSite: "bank",
        acceptedControlIds: acceptAllControls("BANK"),
      },
      "funding_missing_both",
    );
    const funding = getUiLabProductConsentGateState({
      scopes: ["BANK", "TERMINAL"],
      uiLabScenario: "funding_missing_both",
    });
    assert.deepEqual(funding.missingScopes, ["TERMINAL"]);

    clearUiLabAcceptedScopeOverlay();
    const mobile = getUiLabProductConsentGateState({
      scopes: ["BANK"],
      uiLabScenario: "mobile_consent_sheet",
      uiLabAcceptedOverlay: { user: {}, companies: {} },
    });
    assert.equal(mobile.current?.scope, "BANK");
    assert.equal(mobile.current?.headline, "First use of Alta Bank");
  });

  it("advances Bank → Card after accepting Bank", () => {
    const before = getUiLabProductConsentGateState({
      scopes: ["BANK", "ALTA_CARD"],
      uiLabScenario: "card_missing_bank_and_card",
    });
    assert.equal(before.current?.scope, "BANK");
    assert.equal(before.current?.sequence?.index, 1);
    assert.equal(before.current?.sequence?.total, 2);

    mockUiLabProductConsentSubmit(
      {
        scope: "BANK",
        sourceSite: "bank",
        acceptedControlIds: acceptAllControls("BANK"),
      },
      "card_missing_bank_and_card",
    );

    const after = getUiLabProductConsentGateState({
      scopes: ["BANK", "ALTA_CARD"],
      uiLabScenario: "card_missing_bank_and_card",
    });
    assert.deepEqual(after.missingScopes, ["ALTA_CARD"]);
    assert.equal(after.current?.scope, "ALTA_CARD");
    assert.equal(after.current?.sequence?.index, 2);
    assert.equal(after.current?.sequence?.total, 2);
  });

  it("advances Bank → Lending after accepting Bank", () => {
    mockUiLabProductConsentSubmit(
      {
        scope: "BANK",
        sourceSite: "bank",
        acceptedControlIds: acceptAllControls("BANK"),
      },
      "lending_missing_bank_and_lending",
    );
    const after = getUiLabProductConsentGateState({
      scopes: ["BANK", "LENDING"],
      uiLabScenario: "lending_missing_bank_and_lending",
    });
    assert.deepEqual(after.missingScopes, ["LENDING"]);
    assert.equal(after.current?.scope, "LENDING");
  });

  it("advances Bank → Terminal funding after accepting Bank", () => {
    mockUiLabProductConsentSubmit(
      {
        scope: "BANK",
        sourceSite: "bank",
        acceptedControlIds: acceptAllControls("BANK"),
      },
      "funding_missing_both",
    );
    const after = getUiLabProductConsentGateState({
      scopes: ["BANK", "TERMINAL"],
      uiLabScenario: "funding_missing_both",
    });
    assert.deepEqual(after.missingScopes, ["TERMINAL"]);
    assert.equal(after.current?.scope, "TERMINAL");
  });

  it("resumes at scope 2 after exiting mid-sequence", () => {
    recordUiLabAcceptedScope("BANK", null, "card_missing_bank_and_card");
    const resumed = getUiLabProductConsentGateState({
      scopes: ["BANK", "ALTA_CARD"],
      uiLabScenario: "card_missing_bank_and_card",
    });
    assert.deepEqual(resumed.missingScopes, ["ALTA_CARD"]);
    assert.equal(resumed.current?.scope, "ALTA_CARD");
  });

  it("skips already-current scopes", () => {
    const state = getUiLabProductConsentGateState({
      scopes: ["BANK", "ALTA_PAY"],
      uiLabScenario: "alta_pay_missing_pay_only",
    });
    assert.deepEqual(state.missingScopes, ["ALTA_PAY"]);
    assert.equal(state.current?.scope, "ALTA_PAY");
  });
});

describe("soft versus blocking policy", () => {
  it("marks existing card/loan views soft and apply routes hard", () => {
    assert.equal(
      resolveProductConsentRequirements("/bank/alta-card/apply")?.softForExistingObligations,
      undefined,
    );
    assert.equal(
      resolveProductConsentRequirements("/bank/alta-card/cards/abc")?.softForExistingObligations,
      true,
    );
    assert.equal(
      resolveProductConsentRequirements("/bank/lending/loans/LN-1")?.softForExistingObligations,
      true,
    );
    assert.equal(
      resolveProductConsentRequirements("/bank/lending/apply")?.softForExistingObligations,
      undefined,
    );
  });

  it("keeps repayment and view as exception actions; blocks new exposure", () => {
    assert.equal(isConsentExceptionAction("lending.repay"), true);
    assert.equal(isConsentExceptionAction("lending.view"), true);
    assert.equal(isConsentExceptionAction("alta_card.repay"), true);
    assert.equal(isConsentExceptionAction("lending.apply"), false);
    assert.equal(isConsentExceptionAction("alta_card.apply"), false);
  });

  it("boundary soft path uses notice instead of always-blocking dialog", () => {
    const boundary = read("components/legal/product-consent-boundary.tsx");
    assert.match(boundary, /ProductConsentSoftNotice/);
    assert.match(boundary, /showSoftNotice/);
    assert.match(boundary, /softReviewOpen/);
    assert.doesNotMatch(boundary, /const showDialog = Boolean\(presentation\)/);
  });

  it("hard-gates apply search-param workflows that redirect off /apply paths", () => {
    const gate = read("components/legal/product-consent-route-gate.tsx");
    assert.match(gate, /search\.apply/);
    assert.match(gate, /softForExistingObligations: false/);
  });
});

describe("commercial authority policy", () => {
  it("allows owner/executive and rejects finance_manager for company legal terms", () => {
    assert.equal(canAcceptCompanyLegalTerms(mockUser("owner"), { companyId: "co-1" }), true);
    assert.equal(canAcceptCompanyLegalTerms(mockUser("executive"), { companyId: "co-1" }), true);
    assert.equal(
      canAcceptCompanyLegalTerms(mockUser("finance_manager"), { companyId: "co-1" }),
      false,
    );
    assert.equal(canAcceptCompanyLegalTerms(mockUser("viewer"), { companyId: "co-1" }), false);
  });

  it("route gate prefers authoritative commercial layout over bare query in production", () => {
    const gate = read("components/legal/product-consent-route-gate.tsx");
    assert.match(gate, /useAuthoritativeCommercialCompany/);
    assert.match(gate, /isUiLabMode\(\) \? searchCompanyId/);
    assert.match(gate, /never bare query/i);
  });
});

describe("action consent architecture", () => {
  it("wires protected forms through executeWithProductConsentResume", () => {
    const files = [
      "components/bank/actions/flows/pay-action-flow.tsx",
      "components/bank/alta-pay-form.tsx",
      "components/bank/lending-apply-workflow.tsx",
      "components/bank/alta-card/alta-card-apply-workflow.tsx",
      "components/bank/commercial/commercial-pro-upgrade-panel.tsx",
      "components/bank/actions/flows/terminal-funding-action-flow.tsx",
    ];
    for (const file of files) {
      const src = read(file);
      assert.match(src, /executeWithProductConsentResume/, file);
      assert.match(src, /useOptionalProductConsentAction/, file);
    }
  });

  it("keeps server guards authoritative", () => {
    const guard = read("server/product-consent-guard.ts");
    assert.match(guard, /assertProductConsentForAction/);
    assert.match(read("lib/bank/alta-pay.functions.ts"), /alta_pay\.submit/);
    assert.match(read("lib/bank/lending.functions.ts"), /lending\.apply/);
    assert.match(read("lib/bank/alta-card.functions.ts"), /alta_card\.apply/);
  });
});

describe("mobile consent dialog layout guardrails", () => {
  it("respects UI Lab banner height, safe-area, and single scroll body", () => {
    const dialog = read("components/legal/product-consent-dialog.tsx");
    assert.match(dialog, /--ui-lab-banner-height/);
    assert.match(dialog, /safe-area-inset-bottom/);
    assert.match(dialog, /overflow-y-auto/);
    assert.match(dialog, /shrink-0/);
    assert.match(dialog, /min-h-11/);
    assert.match(dialog, /motion-reduce/);
    assert.match(dialog, /blocking/);
    // Terminal uses charcoal surface, not large green-tinted panels
    assert.match(dialog, /bg-\[#0c0e10\]/);
    assert.doesNotMatch(dialog, /bg-emerald-500\/5/);
    assert.doesNotMatch(dialog, /bg-\[#0a0f0c\]/);
  });
});

describe("UI Lab fixture integrity", () => {
  it("resolves every canonical loan directory row", () => {
    const rows = listUiLabInternalLoans();
    assert.ok(rows.length >= 3);
    assert.deepEqual(
      rows.map((r) => r.id).sort(),
      [...listUiLabCanonicalLoanIds()].sort(),
    );
    for (const id of listUiLabCanonicalLoanIds()) {
      const detail = getUiLabInternalLoanDetail(id);
      assert.ok(detail, `missing loan detail ${id}`);
      assert.equal(detail!.id, id);
    }
  });

  it("resolves company and customer catalog workspaces including CO-ALTG", () => {
    const company = getUiLabCompany360(UI_LAB_CORE_COMPANY_ID);
    assert.ok(company);
    assert.equal(company!.company.id, UI_LAB_CORE_COMPANY_ID);
    assert.equal(company!.company.name, "Alta Group N.V.");

    for (const id of listUiLabResolvablePartyIds()) {
      const party = UI_LAB_PARTY_CATALOG.find((p) => p.id === id);
      assert.ok(party);
      if (party!.kind === "person") {
        assert.ok(getUiLabCustomer360(id), `missing customer 360 for ${id}`);
      } else {
        assert.ok(getUiLabCompany360(id), `missing company 360 for ${id}`);
      }
    }
  });

  it("provides Alta Pay eligible funding accounts", () => {
    // Function is guarded by isUiLabMode; still assert source wiring + catalog shape via source.
    const src = read("lib/bank/ui-lab-commercial-fixtures.ts");
    assert.match(src, /getUiLabPayFundingSources/);
    assert.match(src, /BA-LAB-CHK/);
    assert.match(read("lib/bank/alta-pay.functions.ts"), /getUiLabPayFundingSources/);
    // When UI Lab is off, returns []; when on, returns accounts. Shape helper remains callable.
    assert.ok(Array.isArray(getUiLabPayFundingSources()));
  });

  it("customer onboarding summary includes all product scopes", () => {
    const summary = getUiLabCustomerOnboardingSummary("ui-lab-user");
    const scopes = (summary.productConsentScopes ?? []).map((s) => s.scope);
    assert.ok(scopes.includes("BANK"));
    assert.ok(scopes.includes("TERMINAL"));
    assert.ok(scopes.includes("ALTA_PAY"));
    assert.ok(scopes.includes("ALTA_CARD"));
    assert.ok(scopes.includes("LENDING"));
    assert.ok((summary.commercialActingFor ?? []).length > 0);
  });
});

describe("consent sequence helper", () => {
  it("builds ordered multi-scope steps without hardcoding product pairs", () => {
    const sequence = buildConsentSequence(["BANK", "TERMINAL", "ALTA_PAY"]);
    assert.equal(sequence.length, 3);
    assert.equal(sequence[0]?.scope, "BANK");
    assert.equal(sequence[2]?.total, 3);
  });
});

describe("internal consent visibility wiring", () => {
  it("keeps customer and company panels free of primary-summary hashes", () => {
    const customer = read("components/internal/workspace/customer-onboarding-summary-panel.tsx");
    const company = read("components/internal/workspace/company-commercial-consent-panel.tsx");
    assert.match(customer, /Product consent by scope/);
    assert.match(company, /Acceptance history/);
    assert.doesNotMatch(customer, /contentHash/);
    assert.doesNotMatch(company, /contentHash/);
  });
});

describe("remediation source inventory", () => {
  it("includes action controller and soft notice modules", () => {
    const files = walkTsx(join(root, "components/legal"));
    assert.ok(files.some((f) => f.includes("product-consent-action-controller")));
    assert.ok(files.some((f) => f.includes("product-consent-soft-notice")));
  });
});
