import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { d, serializeCryptoMoney } from "./crypto-decimal";

describe("crypto money serialization guards", () => {
  it("serializes zero from a decimal string (portfolio empty-wallet path)", () => {
    assert.equal(serializeCryptoMoney("0"), "0.00");
  });

  it("tolerates accidental JS number zero at the presentation boundary", () => {
    assert.equal(serializeCryptoMoney(0), "0.00");
  });

  it("keeps authoritative d() strict against JS numbers", () => {
    assert.throws(() => d(0), /rejects JavaScript number/);
  });
});
