-- Security & Financial Hardening Sprint 1

CREATE TABLE "SessionHandoff" (
    "id" TEXT NOT NULL,
    "handoffToken" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionHandoff_handoffToken_key" ON "SessionHandoff"("handoffToken");
CREATE INDEX "SessionHandoff_expiresAt_idx" ON "SessionHandoff"("expiresAt");

CREATE TABLE "FinancialIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialIdempotencyRecord_userId_scope_idempotencyKey_key" ON "FinancialIdempotencyRecord"("userId", "scope", "idempotencyKey");
CREATE INDEX "FinancialIdempotencyRecord_userId_idx" ON "FinancialIdempotencyRecord"("userId");
CREATE INDEX "FinancialIdempotencyRecord_expiresAt_idx" ON "FinancialIdempotencyRecord"("expiresAt");

ALTER TABLE "FinancialIdempotencyRecord" ADD CONSTRAINT "FinancialIdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduledTransferExecution" ADD COLUMN IF NOT EXISTS "transferReferenceCode" TEXT;
