-- CreateEnum
CREATE TYPE "TerminalPortfolioOwnerType" AS ENUM ('PERSONAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "TerminalPortfolioStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "TerminalPortfolio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerType" "TerminalPortfolioOwnerType" NOT NULL,
    "ownerUserId" TEXT,
    "ownerCompanyId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "status" "TerminalPortfolioStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminalPortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTerminalSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSelectedPortfolioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTerminalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TerminalPortfolio_ownerUserId_status_idx" ON "TerminalPortfolio"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "TerminalPortfolio_ownerCompanyId_status_idx" ON "TerminalPortfolio"("ownerCompanyId", "status");

-- CreateIndex
CREATE INDEX "TerminalPortfolio_createdByUserId_idx" ON "TerminalPortfolio"("createdByUserId");

-- CreateIndex
CREATE INDEX "TerminalPortfolio_isDefault_idx" ON "TerminalPortfolio"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "UserTerminalSettings_userId_key" ON "UserTerminalSettings"("userId");

-- CreateIndex
CREATE INDEX "UserTerminalSettings_lastSelectedPortfolioId_idx" ON "UserTerminalSettings"("lastSelectedPortfolioId");

-- AddForeignKey
ALTER TABLE "TerminalPortfolio" ADD CONSTRAINT "TerminalPortfolio_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalPortfolio" ADD CONSTRAINT "TerminalPortfolio_ownerCompanyId_fkey" FOREIGN KEY ("ownerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalPortfolio" ADD CONSTRAINT "TerminalPortfolio_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTerminalSettings" ADD CONSTRAINT "UserTerminalSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTerminalSettings" ADD CONSTRAINT "UserTerminalSettings_lastSelectedPortfolioId_fkey" FOREIGN KEY ("lastSelectedPortfolioId") REFERENCES "TerminalPortfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
