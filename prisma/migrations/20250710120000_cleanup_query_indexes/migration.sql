-- Codebase cleanup: query performance indexes (non-destructive)

CREATE INDEX IF NOT EXISTS "BankTransaction_bankAccountId_createdAt_idx"
  ON "BankTransaction"("bankAccountId", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_targetTransactionId_idx"
  ON "AuditLog"("targetTransactionId");

CREATE INDEX IF NOT EXISTS "AuditLog_targetLoanId_idx"
  ON "AuditLog"("targetLoanId");

CREATE INDEX IF NOT EXISTS "User_accountStatus_idx"
  ON "User"("accountStatus");

CREATE INDEX IF NOT EXISTS "Company_verificationStatus_idx"
  ON "Company"("verificationStatus");
