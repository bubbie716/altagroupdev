import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveRecipientSearchStatus,
  validateInvoiceDueDate,
  validateInvoiceRecipient,
} from "@/lib/bank/merchant-invoice-validation";
import type { MerchantInvoiceRecipientOption } from "@/lib/bank/merchant-invoice-types";

const availableRecipient: MerchantInvoiceRecipientOption = {
  kind: "person",
  id: "u1",
  displayName: "Ava Chen",
  subtitle: "ava",
  canReceive: true,
  destinationLabel: "Personal · AB-1",
};

const unavailableRecipient: MerchantInvoiceRecipientOption = {
  ...availableRecipient,
  id: "u2",
  displayName: "Riley Quinn",
  canReceive: false,
  destinationLabel: "No active personal Alta Bank account",
};

describe("resolveRecipientSearchStatus", () => {
  it("returns idle for empty query", () => {
    assert.equal(
      resolveRecipientSearchStatus({
        query: "  ",
        loading: false,
        searchError: false,
        results: [],
        selected: null,
      }),
      "idle",
    );
  });

  it("prefers selected over results", () => {
    assert.equal(
      resolveRecipientSearchStatus({
        query: "Ava",
        loading: false,
        searchError: false,
        results: [availableRecipient],
        selected: availableRecipient,
      }),
      "selected",
    );
  });

  it("returns loading, no-results, search-error, and results", () => {
    assert.equal(
      resolveRecipientSearchStatus({
        query: "ava",
        loading: true,
        searchError: false,
        results: [],
        selected: null,
      }),
      "loading",
    );
    assert.equal(
      resolveRecipientSearchStatus({
        query: "zzz",
        loading: false,
        searchError: false,
        results: [],
        selected: null,
      }),
      "no-results",
    );
    assert.equal(
      resolveRecipientSearchStatus({
        query: "ava",
        loading: false,
        searchError: true,
        results: [],
        selected: null,
      }),
      "search-error",
    );
    assert.equal(
      resolveRecipientSearchStatus({
        query: "ava",
        loading: false,
        searchError: false,
        results: [availableRecipient],
        selected: null,
      }),
      "results",
    );
  });
});

describe("validateInvoiceRecipient", () => {
  it("requires a selectable recipient", () => {
    assert.equal(validateInvoiceRecipient(null), "Select a customer or company to invoice.");
    assert.equal(
      validateInvoiceRecipient(unavailableRecipient),
      "This recipient cannot receive invoices right now.",
    );
    assert.equal(validateInvoiceRecipient(availableRecipient), null);
  });
});

describe("validateInvoiceDueDate", () => {
  const now = new Date(2026, 6, 26, 15, 0, 0);

  it("allows empty due dates", () => {
    assert.equal(validateInvoiceDueDate("", now), null);
    assert.equal(validateInvoiceDueDate(null, now), null);
  });

  it("rejects invalid calendar dates", () => {
    assert.equal(validateInvoiceDueDate("2026-02-31", now), "Enter a valid due date.");
    assert.equal(validateInvoiceDueDate("not-a-date", now), "Enter a valid due date.");
  });

  it("rejects past due dates and allows today/future", () => {
    assert.equal(validateInvoiceDueDate("2026-07-25", now), "Due date cannot be in the past.");
    assert.equal(validateInvoiceDueDate("2026-07-26", now), null);
    assert.equal(validateInvoiceDueDate("2026-08-01", now), null);
  });
});
