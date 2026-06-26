-- CreateEnum
CREATE TYPE "AltaCardType" AS ENUM ('PERSONAL', 'BUSINESS', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "AltaCardTier" AS ENUM ('WHITE', 'NAVY', 'BLACK', 'GOLD');

-- CreateEnum
CREATE TYPE "AltaCardStatus" AS ENUM ('PENDING', 'ACTIVE', 'FROZEN', 'LOST', 'EXPIRED', 'CLOSED', 'DELINQUENT');

-- CreateEnum
CREATE TYPE "AltaCardApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'ALTA_CARD';

-- CreateTable
CREATE TABLE "AltaCardApplication" (
    "id" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "companyId" TEXT,
    "cardType" "AltaCardType" NOT NULL,
    "requestedTier" "AltaCardTier" NOT NULL,
    "status" "AltaCardApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedLimit" DECIMAL(18,2),
    "approvedLimit" DECIMAL(18,2),
    "interestRate" DECIMAL(10,6),
    "reviewNote" TEXT,
    "denialReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AltaCardApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AltaCard" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "companyId" TEXT,
    "applicationId" TEXT,
    "tier" "AltaCardTier" NOT NULL,
    "cardType" "AltaCardType" NOT NULL,
    "status" "AltaCardStatus" NOT NULL DEFAULT 'PENDING',
    "creditLimit" DECIMAL(18,2) NOT NULL,
    "availableCredit" DECIMAL(18,2) NOT NULL,
    "currentBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "statementBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "minimumPaymentDue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interestRate" DECIMAL(10,6) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "cardLastFour" TEXT NOT NULL DEFAULT '0000',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AltaCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AltaEmployeeCard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorizedUserId" TEXT NOT NULL,
    "parentBusinessCardId" TEXT NOT NULL,
    "status" "AltaCardStatus" NOT NULL DEFAULT 'PENDING',
    "employeeSpendLimit" DECIMAL(18,2) NOT NULL,
    "employeeAvailableLimit" DECIMAL(18,2) NOT NULL,
    "employeeCurrentBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cardLastFour" TEXT NOT NULL DEFAULT '0000',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AltaEmployeeCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AltaCardApplication_applicantUserId_idx" ON "AltaCardApplication"("applicantUserId");

-- CreateIndex
CREATE INDEX "AltaCardApplication_companyId_idx" ON "AltaCardApplication"("companyId");

-- CreateIndex
CREATE INDEX "AltaCardApplication_status_idx" ON "AltaCardApplication"("status");

-- CreateIndex
CREATE INDEX "AltaCardApplication_cardType_idx" ON "AltaCardApplication"("cardType");

-- CreateIndex
CREATE INDEX "AltaCardApplication_requestedTier_idx" ON "AltaCardApplication"("requestedTier");

-- CreateIndex
CREATE UNIQUE INDEX "AltaCard_applicationId_key" ON "AltaCard"("applicationId");

-- CreateIndex
CREATE INDEX "AltaCard_ownerUserId_idx" ON "AltaCard"("ownerUserId");

-- CreateIndex
CREATE INDEX "AltaCard_companyId_idx" ON "AltaCard"("companyId");

-- CreateIndex
CREATE INDEX "AltaCard_cardType_idx" ON "AltaCard"("cardType");

-- CreateIndex
CREATE INDEX "AltaCard_tier_idx" ON "AltaCard"("tier");

-- CreateIndex
CREATE INDEX "AltaCard_status_idx" ON "AltaCard"("status");

-- CreateIndex
CREATE INDEX "AltaEmployeeCard_companyId_idx" ON "AltaEmployeeCard"("companyId");

-- CreateIndex
CREATE INDEX "AltaEmployeeCard_authorizedUserId_idx" ON "AltaEmployeeCard"("authorizedUserId");

-- CreateIndex
CREATE INDEX "AltaEmployeeCard_parentBusinessCardId_idx" ON "AltaEmployeeCard"("parentBusinessCardId");

-- CreateIndex
CREATE INDEX "AltaEmployeeCard_status_idx" ON "AltaEmployeeCard"("status");

-- AddForeignKey
ALTER TABLE "AltaCardApplication" ADD CONSTRAINT "AltaCardApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCardApplication" ADD CONSTRAINT "AltaCardApplication_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCardApplication" ADD CONSTRAINT "AltaCardApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCard" ADD CONSTRAINT "AltaCard_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCard" ADD CONSTRAINT "AltaCard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCard" ADD CONSTRAINT "AltaCard_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AltaCardApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaEmployeeCard" ADD CONSTRAINT "AltaEmployeeCard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaEmployeeCard" ADD CONSTRAINT "AltaEmployeeCard_authorizedUserId_fkey" FOREIGN KEY ("authorizedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaEmployeeCard" ADD CONSTRAINT "AltaEmployeeCard_parentBusinessCardId_fkey" FOREIGN KEY ("parentBusinessCardId") REFERENCES "AltaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
