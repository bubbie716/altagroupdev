import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  altaPrivateStatusLabel,
  displayRelationshipTierLabel,
  displayRelationshipTierLabelFromCode,
} from "./relationship-terminology.ts";

describe("relationship terminology", () => {
  it("maps private program codes to published relationship tiers", () => {
    assert.equal(displayRelationshipTierLabel("PRIVATE_CLIENT", 900), "Premier");
    assert.equal(displayRelationshipTierLabel("PRIVATE_ELIGIBLE", 860), "Premier");
  });

  it("shows only Standard, Preferred, and Premier for relationship tier", () => {
    assert.equal(displayRelationshipTierLabel("PREFERRED", 520), "Preferred");
    assert.equal(displayRelationshipTierLabelFromCode("PRIVATE_CLIENT"), "Premier");
  });

  it("separates Alta Private status from relationship tier", () => {
    assert.equal(altaPrivateStatusLabel(true, false), "Active");
    assert.equal(altaPrivateStatusLabel(false, true), "Eligible");
    assert.equal(altaPrivateStatusLabel(false, false), "Not a Member");
  });
});
