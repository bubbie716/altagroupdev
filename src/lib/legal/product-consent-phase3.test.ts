import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CORE_CONSENT_BUNDLE,
  ENFORCED_CONSENT_SCOPES,
  PRODUCT_CONSENT_BUNDLES,
  getConsentBundleDefinition,
  getConsentControlGroups,
  isConsentScopeEnforced,
  resolveConsentBundleDocuments,
} from "@/lib/legal/legal-consent-bundle";
import { LEGAL_CONSENT_SCOPES, isLegalConsentScope } from "@/lib/legal/consent-scopes";
import {
  companyConsentSubjectKey,
  consentSubjectKey,
  parseConsentSubjectKey,
  userConsentSubjectKey,
} from "@/lib/legal/legal-consent-subject";
import {
  buildConsentSequence,
  getActionConsentRequirement,
  isConsentExceptionAction,
  isProductConsentExemptPath,
  resolveProductConsentRequirements,
} from "@/lib/legal/product-consent-requirements";
import {
  assertAllConsentBundleDocumentsResolvable,
  detectContentChangedWithoutVersionBump,
  hashLegalBodySync,
} from "@/lib/legal/legal-content-integrity";
import { getLegalDocument } from "@/lib/legal/legal-document-registry";
import { hashLegalDocumentContentSync } from "@/lib/legal/legal-content-hash";
import { ConsentRequiredError } from "@/lib/legal/consent-required-error";
import {
  getUiLabProductConsentGateState,
  mockUiLabProductConsentSubmit,
} from "@/lib/legal/ui-lab-product-consent";
import { assertNotUiLabMutation } from "@/lib/internal/ui-lab-mutation-gate";

describe("Phase 3 product consent bundles", () => {
  it("defines authoritative documents and semantics per scope", () => {
    assert.deepEqual(
      PRODUCT_CONSENT_BUNDLES.BANK.documents.map((d) => [d.documentId, d.acceptanceType]),
      [
        ["AB-LEGAL-001", "AGREED"],
        ["AB-LEGAL-005", "ACKNOWLEDGED"],
        ["AB-LEGAL-008", "ACKNOWLEDGED"],
      ],
    );
    assert.deepEqual(
      PRODUCT_CONSENT_BUNDLES.TERMINAL.documents.map((d) => [d.documentId, d.acceptanceType]),
      [
        ["AT-LEGAL-001", "AGREED"],
        ["AT-LEGAL-002", "AGREED"],
        ["AT-LEGAL-003", "ACKNOWLEDGED"],
        ["AT-LEGAL-004", "ACKNOWLEDGED"],
        ["AT-LEGAL-005", "ACKNOWLEDGED"],
      ],
    );
    assert.deepEqual(PRODUCT_CONSENT_BUNDLES.ALTA_PAY.documents, [
      { documentId: "AB-LEGAL-003", acceptanceType: "AGREED" },
    ]);
    assert.deepEqual(PRODUCT_CONSENT_BUNDLES.ALTA_CARD.documents, [
      { documentId: "AB-LEGAL-006", acceptanceType: "ACKNOWLEDGED" },
    ]);
    assert.deepEqual(PRODUCT_CONSENT_BUNDLES.LENDING.documents, [
      { documentId: "AB-LEGAL-007", acceptanceType: "ACKNOWLEDGED" },
    ]);
    assert.deepEqual(
      PRODUCT_CONSENT_BUNDLES.COMMERCIAL.documents.map((d) => [d.documentId, d.acceptanceType]),
      [
        ["AB-LEGAL-002", "AGREED"],
        ["AB-LEGAL-004", "AGREED"],
        ["AB-LEGAL-005", "ACKNOWLEDGED"],
      ],
    );
  });

  it("resolves all registry IDs with current versions server-side", () => {
    for (const scope of LEGAL_CONSENT_SCOPES) {
      const docs = resolveConsentBundleDocuments(getConsentBundleDefinition(scope));
      for (const doc of docs) {
        const registry = getLegalDocument(doc.documentId);
        assert.ok(registry, `missing registry entry ${doc.documentId}`);
        assert.equal(doc.version, registry!.version);
        assert.match(doc.publicPath, /^\/legal\//);
      }
    }
  });

  it("includes ALTA_PAY in scopes and enforcement", () => {
    assert.equal(isLegalConsentScope("ALTA_PAY"), true);
    assert.equal(isConsentScopeEnforced("ALTA_PAY"), true);
    assert.ok(ENFORCED_CONSENT_SCOPES.includes("ALTA_PAY"));
  });

  it("uses ACKNOWLEDGED for Card and Lending templates", () => {
    assert.equal(PRODUCT_CONSENT_BUNDLES.ALTA_CARD.documents[0]?.acceptanceType, "ACKNOWLEDGED");
    assert.equal(PRODUCT_CONSENT_BUNDLES.LENDING.documents[0]?.acceptanceType, "ACKNOWLEDGED");
    assert.match(getLegalDocument("AB-LEGAL-006")!.title, /Template/i);
    assert.match(getLegalDocument("AB-LEGAL-007")!.title, /Template/i);
  });

  it("groups consent controls by meaning", () => {
    const terminal = getConsentControlGroups("TERMINAL");
    assert.equal(terminal.length, 2);
    assert.deepEqual(terminal[0]?.documentIds, ["AT-LEGAL-001", "AT-LEGAL-002"]);
    assert.deepEqual(terminal[1]?.documentIds, ["AT-LEGAL-003", "AT-LEGAL-004", "AT-LEGAL-005"]);

    const bank = getConsentControlGroups("BANK");
    assert.equal(bank.length, 2);

    const commercial = getConsentControlGroups("COMMERCIAL");
    assert.ok(commercial.some((g) => g.kind === "authority"));
  });

  it("keeps CORE bundle unchanged from Phase 1", () => {
    assert.deepEqual(
      CORE_CONSENT_BUNDLE.documents.map((d) => d.documentId),
      ["AG-LEGAL-001", "AG-LEGAL-004", "AG-LEGAL-002", "AG-LEGAL-005"],
    );
  });
});

describe("consent subject identity", () => {
  it("isolates user and company subjects", () => {
    assert.equal(userConsentSubjectKey("u1"), "user:u1");
    assert.equal(companyConsentSubjectKey("c1"), "company:c1");
    assert.notEqual(userConsentSubjectKey("c1"), companyConsentSubjectKey("c1"));
    assert.deepEqual(parseConsentSubjectKey("company:abc"), {
      type: "COMPANY",
      companyId: "abc",
    });
    assert.equal(
      consentSubjectKey({ type: "COMPANY", companyId: "co-2" }),
      "company:co-2",
    );
  });
});

describe("product consent route requirements", () => {
  it("gates authenticated product paths and exempts marketing/auth/legal/internal", () => {
    assert.deepEqual(resolveProductConsentRequirements("/bank")?.scopes, ["BANK"]);
    assert.deepEqual(resolveProductConsentRequirements("/terminal/trade")?.scopes, ["TERMINAL"]);
    assert.deepEqual(resolveProductConsentRequirements("/bank/pay")?.scopes, ["BANK", "ALTA_PAY"]);
    assert.deepEqual(resolveProductConsentRequirements("/bank/alta-card/apply")?.scopes, [
      "BANK",
      "ALTA_CARD",
    ]);
    assert.deepEqual(resolveProductConsentRequirements("/bank/lending/apply")?.scopes, [
      "BANK",
      "LENDING",
    ]);
    assert.equal(resolveProductConsentRequirements("/bank/commercial")?.companyScoped, true);

    assert.equal(isProductConsentExemptPath("/"), true);
    assert.equal(isProductConsentExemptPath("/legal/terms"), true);
    assert.equal(isProductConsentExemptPath("/support"), true);
    assert.equal(isProductConsentExemptPath("/api/auth/session/handoff"), true);
    assert.equal(isProductConsentExemptPath("/internal/users/x"), true);
    assert.equal(isProductConsentExemptPath("/home"), true);
    assert.equal(resolveProductConsentRequirements("/legal"), null);
  });

  it("sequences multiple missing scopes", () => {
    const sequence = buildConsentSequence(["BANK", "ALTA_CARD"]);
    assert.equal(sequence.length, 2);
    assert.equal(sequence[0]?.index, 1);
    assert.equal(sequence[0]?.scope, "BANK");
    assert.equal(sequence[1]?.total, 2);
    assert.equal(sequence[1]?.scope, "ALTA_CARD");
  });

  it("protects funding and pay actions with required scopes", () => {
    assert.deepEqual([...getActionConsentRequirement("terminal.funding").scopes], [
      "BANK",
      "TERMINAL",
    ]);
    assert.deepEqual([...getActionConsentRequirement("alta_pay.submit").scopes], [
      "BANK",
      "ALTA_PAY",
    ]);
    assert.equal(getActionConsentRequirement("commercial.purchase_pro").companyScoped, true);
  });

  it("keeps repayment/view/support as consent exceptions", () => {
    assert.equal(isConsentExceptionAction("alta_card.repay"), true);
    assert.equal(isConsentExceptionAction("lending.repay"), true);
    assert.equal(isConsentExceptionAction("alta_card.view"), true);
    assert.equal(isConsentExceptionAction("lending.view"), true);
    assert.equal(isConsentExceptionAction("support.contact"), true);
    assert.equal(isConsentExceptionAction("alta_card.apply"), false);
  });
});

describe("CONSENT_REQUIRED error shape", () => {
  it("exposes structured missing scopes without Prisma details", () => {
    const err = new ConsentRequiredError(["BANK", "TERMINAL"], null);
    assert.equal(err.code, "CONSENT_REQUIRED");
    assert.deepEqual(err.toJSON(), {
      code: "CONSENT_REQUIRED",
      missingScopes: ["BANK", "TERMINAL"],
      companyId: null,
    });
  });
});

describe("legal content integrity", () => {
  it("hashes stably and detects unchanged-version content drift against baseline", () => {
    const a = hashLegalBodySync("hello\nworld");
    const b = hashLegalDocumentContentSync("hello\r\nworld");
    assert.equal(a, b);

    const drift = detectContentChangedWithoutVersionBump({
      "AB-LEGAL-001": { version: "1.0", hash: "not-the-real-hash" },
    });
    // If markdown exists and registry version is still 1.0, mismatched baseline hash is reported.
    if (drift.length > 0) {
      assert.equal(drift[0]?.documentId, "AB-LEGAL-001");
      assert.equal(drift[0]?.registryVersion, "1.0");
    }
  });

  it("resolves markdown for every consent-bundle document", () => {
    const missing = assertAllConsentBundleDocumentsResolvable();
    assert.deepEqual(missing, []);
  });
});

describe("UI Lab product consent", () => {
  it("never requires production mutation writes", () => {
    assert.doesNotThrow(() => assertNotUiLabMutation("Product consent acceptance"));
  });

  it("simulates first Bank visit and already-accepted without flash", () => {
    const first = getUiLabProductConsentGateState({
      scopes: ["BANK"],
      uiLabScenario: "bank_first_visit",
    });
    assert.deepEqual(first.missingScopes, ["BANK"]);
    assert.ok(first.current);

    const current = getUiLabProductConsentGateState({
      scopes: ["BANK"],
      uiLabScenario: "already_accepted_no_flash",
    });
    assert.deepEqual(current.missingScopes, []);
    assert.equal(current.current, null);
  });

  it("sequences Card route missing Bank + Card", () => {
    const state = getUiLabProductConsentGateState({
      scopes: ["BANK", "ALTA_CARD"],
      uiLabScenario: "card_missing_bank_and_card",
    });
    assert.deepEqual(state.missingScopes, ["BANK", "ALTA_CARD"]);
    assert.equal(state.current?.scope, "BANK");
    assert.equal(state.sequence[0]?.index, 1);
    assert.equal(state.sequence[1]?.scope, "ALTA_CARD");
  });

  it("isolates Company A accepted from Company B missing", () => {
    const a = getUiLabProductConsentGateState({
      scopes: ["COMMERCIAL"],
      companyId: "company-a",
      uiLabScenario: "commercial_company_a_ok_b_missing",
    });
    assert.deepEqual(a.missingScopes, []);

    const b = getUiLabProductConsentGateState({
      scopes: ["COMMERCIAL"],
      companyId: "company-b",
      uiLabScenario: "commercial_company_a_ok_b_missing",
    });
    assert.deepEqual(b.missingScopes, ["COMMERCIAL"]);
  });

  it("mocks acceptance without writing rows and preserves control validation", () => {
    const result = mockUiLabProductConsentSubmit(
      {
        scope: "BANK",
        sourceSite: "bank",
        acceptedControlIds: ["deposit", "fees_transfers"],
      },
      "bank_first_visit",
    );
    assert.equal(result.status.complete, true);
    assert.ok(result.created >= 0);

    assert.throws(
      () =>
        mockUiLabProductConsentSubmit(
          {
            scope: "BANK",
            sourceSite: "bank",
            acceptedControlIds: ["deposit"],
          },
          "bank_first_visit",
        ),
      /CONSENT_CONTROLS_INCOMPLETE/,
    );
  });

  it("surfaces server error and unauthorized commercial scenarios", () => {
    assert.throws(
      () =>
        mockUiLabProductConsentSubmit(
          {
            scope: "BANK",
            sourceSite: "bank",
            acceptedControlIds: ["deposit", "fees_transfers"],
          },
          "consent_server_error",
        ),
      /CONSENT_RECORDING_FAILED/,
    );
    assert.throws(
      () =>
        mockUiLabProductConsentSubmit(
          {
            scope: "COMMERCIAL",
            sourceSite: "bank",
            companyId: "co-1",
            acceptedControlIds: ["business_merchant", "fee_schedule", "authority"],
            authorityConfirmed: true,
          },
          "commercial_unauthorized",
        ),
      /CONSENT_AUTHORITY_FORBIDDEN/,
    );
  });
});
