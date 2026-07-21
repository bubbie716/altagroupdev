import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it, beforeEach } from "node:test";
import {
  getProofFileUrl,
  hasStoredProof,
  resolveProofStorageKey,
} from "@/lib/storage/proof-upload.constants";
import {
  buildOAuthStateCookie,
  hashOAuthStateNonce,
  validateOAuthStateCookie,
} from "@/server/oauth-state";
import { checkRateLimit, resetRateLimitBuckets } from "@/server/rate-limit.service";
import { updateCommercialPlanSettings } from "@/server/commercial-plan.service";
import { createSessionHandoff, redeemSessionHandoff } from "@/server/session-handoff";
import { prisma } from "@/server/db";

function mockRequest(cookieHeader: string | null): Request {
  return new Request("https://altagroup.dev/api/auth/discord/callback", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe("OAuth state protection", () => {
  it("rejects missing state nonce", () => {
    assert.equal(validateOAuthStateCookie(mockRequest(null), undefined), false);
    assert.equal(validateOAuthStateCookie(mockRequest(null), ""), false);
  });

  it("rejects mismatched state cookie", () => {
    const nonce = "abc123nonce";
    const cookie = buildOAuthStateCookie(nonce, "altagroup.dev");
    const request = mockRequest(cookie);
    assert.equal(validateOAuthStateCookie(request, "different-nonce"), false);
  });

  it("accepts matching state cookie", () => {
    const nonce = "secure-nonce-value";
    const cookie = buildOAuthStateCookie(nonce, "altagroup.dev");
    const request = mockRequest(cookie);
    assert.equal(validateOAuthStateCookie(request, nonce), true);
    assert.equal(hashOAuthStateNonce(nonce), createHash("sha256").update(nonce).digest("hex"));
  });

  it("sets Domain=.altagroup.dev on OAuth state cookies in production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.ALTA_COOKIE_DOMAIN;
    try {
      const cookie = buildOAuthStateCookie("nonce-prod-domain", "terminal.altagroup.dev");
      assert.match(cookie, /Domain=\.altagroup\.dev/);
      const wwwCookie = buildOAuthStateCookie("nonce-www", "www.altagroup.dev");
      assert.match(wwwCookie, /Domain=\.altagroup\.dev/);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe("rate limiting", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("blocks excessive requests", () => {
    const config = { key: "test:127.0.0.1", limit: 3, windowMs: 60_000 };
    assert.equal(checkRateLimit(config).allowed, true);
    assert.equal(checkRateLimit(config).allowed, true);
    assert.equal(checkRateLimit(config).allowed, true);
    const blocked = checkRateLimit(config);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterMs > 0);
  });
});

describe("private proof storage URLs", () => {
  it("routes private proof paths through authenticated download endpoint", () => {
    const storageKey = "bank-proofs/user-1/deposit/20250709-120000-abc123.jpg";
    assert.equal(
      getProofFileUrl(storageKey, { transactionId: "tx-1" }),
      "/api/bank/transactions/tx-1/proof",
    );
    assert.equal(getProofFileUrl(storageKey), null);
    assert.equal(hasStoredProof(storageKey), true);
    assert.equal(resolveProofStorageKey(storageKey), storageKey);
  });

  it("preserves legacy public blob URLs for migration", () => {
    const legacy = "https://blob.vercel-storage.com/bank-proofs/user-1/deposit/old.jpg";
    assert.equal(
      getProofFileUrl(legacy, { transactionId: "tx-legacy" }),
      "/api/bank/transactions/tx-legacy/proof",
    );
    assert.equal(resolveProofStorageKey(legacy), "bank-proofs/user-1/deposit/old.jpg");
  });
});

describe("commercial plan privilege escalation", { skip: !hasDatabaseUrl() }, () => {
  it("rejects privileged plan fields without operator override", async () => {
    const company = await prisma.company.findFirst();
    assert.ok(company, "Need a company row");

    await assert.rejects(
      () =>
        updateCommercialPlanSettings("merchant-user", company.id, {
          planStatus: "ACTIVE",
          enabledFeatures: ["payroll"],
        }),
      (error: Error) => error.message === "FORBIDDEN",
    );
  });
});

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

async function hasSessionHandoffTable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "SessionHandoff" LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("session handoff redemption", { skip: !hasDatabaseUrl() }, () => {
  it("redeems once and rejects second redemption", async (t) => {
    if (!(await hasSessionHandoffTable())) {
      t.skip("SessionHandoff migration not applied");
      return;
    }
    const handoffToken = await createSessionHandoff("integration-session-token");
    assert.ok(handoffToken);

    const first = await redeemSessionHandoff(handoffToken);
    assert.ok(first);
    assert.equal(first.sessionToken, "integration-session-token");

    const second = await redeemSessionHandoff(handoffToken);
    assert.equal(second, null);

    await prisma.sessionHandoff.deleteMany({ where: { handoffToken } });
  });

  it("rejects expired handoff tokens", async (t) => {
    if (!(await hasSessionHandoffTable())) {
      t.skip("SessionHandoff migration not applied");
      return;
    }
    const handoffToken = `expired-${Date.now()}`;
    await prisma.sessionHandoff.create({
      data: {
        handoffToken,
        sessionToken: "expired-session",
        expiresAt: new Date(Date.now() - 1_000),
      },
    });

    const redeemed = await redeemSessionHandoff(handoffToken);
    assert.equal(redeemed, null);

    await prisma.sessionHandoff.deleteMany({ where: { handoffToken } });
  });
});

describe("deposit approval concurrency", { skip: !hasDatabaseUrl() }, () => {
  it("allows only one conditional PENDING→APPROVED transition", async () => {
    const account = await prisma.bankAccount.findFirst({
      where: { status: "ACTIVE" },
    });
    assert.ok(account, "Need an active bank account");

    const deposit = await prisma.bankTransaction.create({
      data: {
        bankAccountId: account.id,
        type: "DEPOSIT",
        amount: 12.34,
        status: "PENDING",
        description: "Integration deposit race test",
        referenceCode: `DEP-RACE-${Date.now()}`,
      },
    });

    const attemptApproval = () =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "BankTransaction" WHERE id = ${deposit.id} FOR UPDATE`;
        return tx.bankTransaction.updateMany({
          where: { id: deposit.id, status: "PENDING", type: "DEPOSIT" },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
          },
        });
      });

    const [first, second] = await Promise.all([attemptApproval(), attemptApproval()]);
    const successCount = [first.count, second.count].filter((count) => count === 1).length;
    assert.equal(successCount, 1);

    await prisma.bankTransaction.delete({ where: { id: deposit.id } });
  });
});

async function hasFinancialIdempotencyTable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "FinancialIdempotencyRecord" LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("financial idempotency", { skip: !hasDatabaseUrl() }, () => {
  it("returns cached result on retry with same payload", async (t) => {
    if (!(await hasFinancialIdempotencyTable())) {
      t.skip("FinancialIdempotencyRecord migration not applied");
      return;
    }

    const user = await prisma.user.findFirst();
    assert.ok(user, "Need a user row");

    const key = `unit-retry-${Date.now()}`;
    let executions = 0;
    const { beginFinancialIdempotency } = await import("@/server/financial-idempotency.service");
    const input = {
      userId: user.id,
      scope: "internal_transfer" as const,
      idempotencyKey: key,
      payload: { amount: 25, memo: "retry-test" },
      execute: async () => {
        executions += 1;
        return { referenceCode: "TRF-TEST" };
      },
    };

    const first = await beginFinancialIdempotency(input);
    const second = await beginFinancialIdempotency(input);
    assert.equal(executions, 1);
    assert.deepEqual(first, second);

    await prisma.financialIdempotencyRecord.deleteMany({
      where: { userId: user.id, idempotencyKey: key },
    });
  });

  it("rejects same key with different payload", async (t) => {
    if (!(await hasFinancialIdempotencyTable())) {
      t.skip("FinancialIdempotencyRecord migration not applied");
      return;
    }

    const user = await prisma.user.findFirst();
    assert.ok(user, "Need a user row");

    const key = `unit-conflict-${Date.now()}`;
    const { beginFinancialIdempotency, IdempotencyConflictError } = await import(
      "@/server/financial-idempotency.service"
    );

    await beginFinancialIdempotency({
      userId: user.id,
      scope: "alta_pay",
      idempotencyKey: key,
      payload: { amount: 10 },
      execute: async () => ({ referenceCode: "PAY-1" }),
    });

    await assert.rejects(
      () =>
        beginFinancialIdempotency({
          userId: user.id,
          scope: "alta_pay",
          idempotencyKey: key,
          payload: { amount: 20 },
          execute: async () => ({ referenceCode: "PAY-2" }),
        }),
      (error: Error) => error instanceof IdempotencyConflictError,
    );

    await prisma.financialIdempotencyRecord.deleteMany({
      where: { userId: user.id, idempotencyKey: key },
    });
  });
});

describe("loan interest guarantee race", { skip: !hasDatabaseUrl() }, () => {
  it("allows only one PENDING→GUARANTEED transition per schedule item", async (t) => {
    const loan = await prisma.loan.findFirst();
    if (!loan) {
      t.skip("Need a loan row");
      return;
    }

    const item = await prisma.loanInterestScheduleItem.create({
      data: {
        loanId: loan.id,
        installmentNumber: 99_999,
        guaranteeDate: new Date(),
        interestAmount: 1.5,
        status: "PENDING",
      },
    });

    const attempt = () =>
      prisma.loanInterestScheduleItem.updateMany({
        where: { id: item.id, status: "PENDING" },
        data: { status: "GUARANTEED" },
      });

    const [first, second] = await Promise.all([attempt(), attempt()]);
    const successCount = [first.count, second.count].filter((count) => count === 1).length;
    assert.equal(successCount, 1);

    await prisma.loanInterestScheduleItem.delete({ where: { id: item.id } });
  });
});

describe("enumeration hardening", () => {
  it("requires authentication for payable company search", async () => {
    const { searchPayableCompaniesForPay } = await import("@/lib/bank/alta-pay.functions");
    await assert.rejects(() => searchPayableCompaniesForPay({ data: "acme" }));
  });
});

describe("assertUserRateLimit", () => {
  it("throws when user exceeds configured limit", async () => {
    const { assertUserRateLimit, resetRateLimitBuckets } = await import(
      "@/server/rate-limit.service"
    );
    resetRateLimitBuckets();
    const userId = "rate-limit-user";
    assertUserRateLimit(userId, "test-action", 2, 60_000);
    assertUserRateLimit(userId, "test-action", 2, 60_000);
    assert.throws(
      () => assertUserRateLimit(userId, "test-action", 2, 60_000),
      (error: Error) => error.message === "RATE_LIMITED",
    );
  });
});
