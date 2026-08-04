import assert from "node:assert/strict";
import test from "node:test";
import { mergeRecentAccountTransactions } from "./account-activity.ts";

const row = (id: string, submitted: string, status = "approved") => ({
  id,
  referenceCode: id,
  type: "deposit",
  account: "AB-1000",
  holder: "Carter",
  amount: "ƒ100.00",
  method: "Bank",
  status,
  submitted,
  proofImageUrl: null,
  proofFileName: null,
  proofUploadedAt: null,
  hasProof: false,
  description: "Deposit",
  memo: null,
});

test("account activity deduplicates rows and prefers pending status", () => {
  const result = mergeRecentAccountTransactions(
    [row("tx-1", "2026-08-03T12:00:00Z", "pending")],
    [row("tx-1", "2026-08-03T12:00:00Z"), row("tx-2", "2026-08-02T12:00:00Z")],
  );
  assert.deepEqual(result.map((item) => item.id), ["tx-1", "tx-2"]);
  assert.equal(result[0]?.status, "pending");
});
