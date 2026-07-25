import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  BANK_ACTION_IDS,
  isBankActionId,
  parseBankActionId,
} from "../../lib/bank/bank-action-ids.ts";
import {
  mergeBankActionSearch,
  parseBankActionSearch,
  sanitizeBankActionSearch,
  stripBankActionSearch,
} from "../../lib/bank/bank-action-url.ts";
import {
  bankActionPhaseAfterBack,
  canDismissBankAction,
  ensureIdempotencyKey,
} from "../../lib/bank/bank-action-flow.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("bank action registry", () => {
  it("parses known actions and ignores invalid values", () => {
    assert.equal(parseBankActionId("deposit"), "deposit");
    assert.equal(parseBankActionId("not-real"), null);
    assert.equal(isBankActionId("move-money"), true);
    assert.ok(BANK_ACTION_IDS.includes("card-freeze"));
  });

  it("does not advertise private banking product actions", () => {
    for (const id of BANK_ACTION_IDS) {
      assert.doesNotMatch(id, /private/i);
    }
    const openFlow = read("components/bank/actions/flows/open-account-action-flow.tsx");
    assert.match(openFlow, /Alta Gold is not a deposit account/);
    assert.doesNotMatch(openFlow, /Private Banking|Alta Private/i);
  });
});

describe("bank action URL contract", () => {
  it("parses query-driven action search", () => {
    assert.deepEqual(parseBankActionSearch("?action=deposit&accountId=acc_1"), {
      action: "deposit",
      accountId: "acc_1",
      cardId: undefined,
      companyId: undefined,
      scope: undefined,
    });
    assert.equal(parseBankActionSearch({ action: "nope" }).action, null);
  });

  it("strips only action-related keys", () => {
    const next = stripBankActionSearch({
      action: "deposit",
      accountId: "a1",
      tab: "now",
      companyId: "c1",
    });
    assert.equal("action" in next, false);
    assert.equal("accountId" in next, false);
    assert.equal(next.tab, "now");
  });

  it("merges action params without inventing empty ids", () => {
    const next = mergeBankActionSearch({ tab: "scheduled" }, { action: "pay", accountId: "a1" });
    assert.equal(next.action, "pay");
    assert.equal(next.accountId, "a1");
    assert.equal(next.tab, "scheduled");
    assert.equal("cardId" in next, false);
  });

  it("sanitizes invalid action values", () => {
    const next = sanitizeBankActionSearch({ action: "wire-fantasy", foo: "1" });
    assert.equal("action" in next, false);
    assert.equal(next.foo, "1");
  });
});

describe("bank action state machine helpers", () => {
  it("blocks dismiss only while submitting", () => {
    assert.equal(canDismissBankAction("submitting"), false);
    assert.equal(canDismissBankAction("success"), true);
    assert.equal(canDismissBankAction("review"), true);
  });

  it("walks back review → details → selection", () => {
    assert.equal(bankActionPhaseAfterBack("review"), "details");
    assert.equal(bankActionPhaseAfterBack("details"), "selection");
    assert.equal(bankActionPhaseAfterBack("success"), "success");
  });

  it("keeps idempotency keys stable for one attempt", () => {
    const ref = { current: null as string | null };
    const first = ensureIdempotencyKey(ref);
    const second = ensureIdempotencyKey(ref);
    assert.equal(first, second);
    assert.ok(first.length > 8);
  });
});

describe("responsive bank action architecture", () => {
  it("uses one dialog tree with mobile bottom-sheet CSS", () => {
    const shell = read("components/bank/actions/responsive-bank-action.tsx");
    assert.match(shell, /ResponsiveBankAction/);
    assert.match(shell, /max-md:bottom-/);
    assert.match(shell, /safe-area-inset-bottom/);
    assert.match(shell, /motion-reduce/);
    assert.doesNotMatch(shell, /useMediaQueryMax/);
    assert.match(shell, /CLOSE_RESET_MS/);
    assert.match(shell, /Discard this draft/);
  });

  it("hosts a single active overlay from Bank chrome", () => {
    const host = read("components/bank/actions/bank-action-host.tsx");
    const layout = read("components/bank/bank-page-layout.tsx");
    assert.match(host, /Mounts at most one active Bank action overlay/);
    assert.match(layout, /BankActionHost/);
  });

  it("reuses flow components on standalone pages", () => {
    const deposit = read("routes/bank/deposit.tsx");
    const withdraw = read("routes/bank/withdraw.tsx");
    const open = read("routes/bank/open.tsx");
    const intrabank = read("routes/bank/transfers/intrabank.tsx");
    assert.match(deposit, /DepositActionFlow/);
    assert.match(withdraw, /WithdrawActionFlow/);
    assert.match(open, /OpenAccountActionFlow/);
    assert.match(intrabank, /TransferActionFlow/);
  });

  it("requires review before financial submission in money flows", () => {
    const transfer = read("components/bank/actions/flows/transfer-action-flow.tsx");
    const deposit = read("components/bank/actions/flows/deposit-action-flow.tsx");
    const withdraw = read("components/bank/actions/flows/withdraw-action-flow.tsx");
    for (const source of [transfer, deposit, withdraw]) {
      assert.match(source, /setPhase\("review"\)/);
      assert.match(source, /phase === "review"/);
      assert.match(source, /setPhase\("submitting"\)/);
    }
  });

  it("keeps pending semantics for deposit and withdrawal success", () => {
    const deposit = read("components/bank/actions/flows/deposit-action-flow.tsx");
    const withdraw = read("components/bank/actions/flows/withdraw-action-flow.tsx");
    assert.match(deposit, /Pending review/);
    assert.match(deposit, /not available until approved/);
    assert.match(withdraw, /Pending review/);
    assert.match(withdraw, /not[\s\S]*completed until approved/);
  });

  it("move money chooser branches without jargon or fake interbank", () => {
    const chooser = read("components/bank/move-money-chooser.tsx");
    const move = read("components/bank/actions/flows/move-money-action-flow.tsx");
    assert.match(chooser, /Between my accounts/);
    assert.match(chooser, /Pay someone/);
    assert.doesNotMatch(chooser, /intrabank/i);
    assert.match(move, /Coming later/);
    assert.match(move, /disabled/);
  });

  it("scheduled and recurring review copy is progressive", () => {
    const transfer = read("components/bank/actions/flows/transfer-action-flow.tsx");
    assert.match(transfer, /timing === "scheduled"/);
    assert.match(transfer, /timing === "recurring"/);
    assert.match(transfer, /Frequency/);
    assert.match(transfer, /First run/);
  });
});
