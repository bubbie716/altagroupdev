-- CreateTable
CREATE TABLE "UserBankSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultAltaPayReceiveAccountId" TEXT,
    "defaultAltaPayFundingAccountId" TEXT,
    "discordNotificationPrefs" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBankSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBankSettings_userId_key" ON "UserBankSettings"("userId");

-- CreateIndex
CREATE INDEX "UserBankSettings_defaultAltaPayReceiveAccountId_idx" ON "UserBankSettings"("defaultAltaPayReceiveAccountId");

-- CreateIndex
CREATE INDEX "UserBankSettings_defaultAltaPayFundingAccountId_idx" ON "UserBankSettings"("defaultAltaPayFundingAccountId");

-- AddForeignKey
ALTER TABLE "UserBankSettings" ADD CONSTRAINT "UserBankSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBankSettings" ADD CONSTRAINT "UserBankSettings_defaultAltaPayReceiveAccountId_fkey" FOREIGN KEY ("defaultAltaPayReceiveAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBankSettings" ADD CONSTRAINT "UserBankSettings_defaultAltaPayFundingAccountId_fkey" FOREIGN KEY ("defaultAltaPayFundingAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
