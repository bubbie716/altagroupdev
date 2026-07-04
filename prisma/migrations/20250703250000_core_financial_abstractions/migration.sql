-- CreateEnum
CREATE TYPE "BankAccountOwnershipType" AS ENUM ('PERSONAL', 'COMPANY');
CREATE TYPE "PaymentType" AS ENUM ('ALTA_PAY', 'INTRABANK_TRANSFER', 'INTERBANK_TRANSFER');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REVERSED');
CREATE TYPE "TransferGroupType" AS ENUM ('ALTA_PAY', 'INTRABANK_TRANSFER', 'INTERBANK_TRANSFER', 'ADJUSTMENT_REVERSAL', 'MANUAL_REVERSAL', 'OTHER');
CREATE TYPE "TransferGroupStatus" AS ENUM ('PENDING', 'COMPLETED', 'REVERSED', 'FAILED');
CREATE TYPE "TransferLedgerRole" AS ENUM ('DEBIT', 'CREDIT', 'SINGLE', 'REVERSAL_DEBIT', 'REVERSAL_CREDIT');
CREATE TYPE "FinancialInstitutionType" AS ENUM ('BANK', 'CLEARING_HOUSE', 'BROKER_DEALER', 'CUSTODIAN', 'OTHER');
CREATE TYPE "FinancialInstitutionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "RoutingNumberStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "PrivateBankingRelationshipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');
CREATE TYPE "DocumentSubjectType" AS ENUM ('BANK_TRANSACTION', 'LOAN_APPLICATION', 'LOAN', 'ALTA_CARD', 'DEAL_ROOM', 'COMPANY', 'USER', 'EXCHANGE_LISTING', 'OTHER');
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');
CREATE TYPE "StaffAssignmentSubjectType" AS ENUM ('USER', 'COMPANY', 'LOAN_APPLICATION', 'ALTA_CARD_APPLICATION', 'ALTA_CARD_REVIEW', 'DEAL_ROOM', 'COMPANY_VERIFICATION', 'EXCHANGE_LISTING', 'OTHER');
CREATE TYPE "StaffAssignmentType" AS ENUM ('ALTA_PRIVATE_BANKER', 'COMMERCIAL_BANKER', 'CREDIT_DESK', 'DEAL_ROOM_OFFICER', 'COMPANY_VERIFICATION', 'EXCHANGE_REVIEWER', 'OTHER');
CREATE TYPE "StaffAssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN "ownershipType" "BankAccountOwnershipType" NOT NULL DEFAULT 'PERSONAL';
UPDATE "BankAccount" SET "ownershipType" = 'COMPANY' WHERE "companyId" IS NOT NULL;

-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN "transferGroupId" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "ledgerRole" "TransferLedgerRole";

-- CreateTable
CREATE TABLE "TransferGroup" (
    "id" TEXT NOT NULL,
    "groupType" "TransferGroupType" NOT NULL,
    "status" "TransferGroupStatus" NOT NULL DEFAULT 'PENDING',
    "referenceCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TransferGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payerUserId" TEXT,
    "recipientUserId" TEXT,
    "sourceBankAccountId" TEXT,
    "destinationBankAccountId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'FLR',
    "referenceCode" TEXT NOT NULL,
    "memo" TEXT,
    "initiatedByUserId" TEXT NOT NULL,
    "metadata" JSONB,
    "transferGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialInstitution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "routingPrefix" TEXT,
    "institutionType" "FinancialInstitutionType" NOT NULL,
    "status" "FinancialInstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "isAlta" BOOLEAN NOT NULL DEFAULT false,
    "isNCCParticipant" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialInstitution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoutingNumber" (
    "id" TEXT NOT NULL,
    "routingNumber" TEXT NOT NULL,
    "financialInstitutionId" TEXT NOT NULL,
    "status" "RoutingNumberStatus" NOT NULL DEFAULT 'ACTIVE',
    "label" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingNumber_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivateBankingRelationship" (
    "id" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "bankerUserId" TEXT NOT NULL,
    "status" "PrivateBankingRelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateBankingRelationship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "subjectType" "DocumentSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "documentKind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storageKey" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffAssignment" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "subjectType" "StaffAssignmentSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "assignmentType" "StaffAssignmentType" NOT NULL,
    "status" "StaffAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAssignment_pkey" PRIMARY KEY ("id")
);

-- Seed Alta Bank institution (idempotent)
INSERT INTO "FinancialInstitution" ("id", "name", "shortName", "routingPrefix", "institutionType", "status", "isAlta", "isNCCParticipant", "updatedAt")
VALUES ('inst-alta-bank', 'Alta Bank', 'Alta', 'AB', 'BANK', 'ACTIVE', true, false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "RoutingNumber" ("id", "routingNumber", "financialInstitutionId", "status", "label", "updatedAt")
VALUES ('rn-alta-primary', '011000001', 'inst-alta-bank', 'ACTIVE', 'Alta Bank Primary Routing', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "TransferGroup_referenceCode_key" ON "TransferGroup"("referenceCode");
CREATE INDEX "TransferGroup_groupType_status_idx" ON "TransferGroup"("groupType", "status");
CREATE INDEX "TransferGroup_createdAt_idx" ON "TransferGroup"("createdAt");

CREATE UNIQUE INDEX "Payment_referenceCode_key" ON "Payment"("referenceCode");
CREATE UNIQUE INDEX "Payment_transferGroupId_key" ON "Payment"("transferGroupId");
CREATE INDEX "Payment_paymentType_status_idx" ON "Payment"("paymentType", "status");
CREATE INDEX "Payment_payerUserId_idx" ON "Payment"("payerUserId");
CREATE INDEX "Payment_recipientUserId_idx" ON "Payment"("recipientUserId");
CREATE INDEX "Payment_sourceBankAccountId_idx" ON "Payment"("sourceBankAccountId");
CREATE INDEX "Payment_destinationBankAccountId_idx" ON "Payment"("destinationBankAccountId");
CREATE INDEX "Payment_initiatedByUserId_idx" ON "Payment"("initiatedByUserId");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

CREATE UNIQUE INDEX "FinancialInstitution_routingPrefix_key" ON "FinancialInstitution"("routingPrefix");
CREATE INDEX "FinancialInstitution_status_idx" ON "FinancialInstitution"("status");
CREATE INDEX "FinancialInstitution_isAlta_idx" ON "FinancialInstitution"("isAlta");

CREATE UNIQUE INDEX "RoutingNumber_routingNumber_key" ON "RoutingNumber"("routingNumber");
CREATE INDEX "RoutingNumber_financialInstitutionId_idx" ON "RoutingNumber"("financialInstitutionId");
CREATE INDEX "RoutingNumber_status_idx" ON "RoutingNumber"("status");

CREATE INDEX "PrivateBankingRelationship_customerUserId_status_idx" ON "PrivateBankingRelationship"("customerUserId", "status");
CREATE INDEX "PrivateBankingRelationship_bankerUserId_status_idx" ON "PrivateBankingRelationship"("bankerUserId", "status");

CREATE INDEX "Document_subjectType_subjectId_idx" ON "Document"("subjectType", "subjectId");
CREATE INDEX "Document_status_idx" ON "Document"("status");
CREATE INDEX "Document_uploadedByUserId_idx" ON "Document"("uploadedByUserId");

CREATE INDEX "StaffAssignment_staffUserId_status_idx" ON "StaffAssignment"("staffUserId", "status");
CREATE INDEX "StaffAssignment_subjectType_subjectId_idx" ON "StaffAssignment"("subjectType", "subjectId");
CREATE INDEX "StaffAssignment_assignmentType_status_idx" ON "StaffAssignment"("assignmentType", "status");

CREATE INDEX "BankAccount_ownershipType_idx" ON "BankAccount"("ownershipType");
CREATE INDEX "BankTransaction_transferGroupId_idx" ON "BankTransaction"("transferGroupId");

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_transferGroupId_fkey" FOREIGN KEY ("transferGroupId") REFERENCES "TransferGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_sourceBankAccountId_fkey" FOREIGN KEY ("sourceBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_destinationBankAccountId_fkey" FOREIGN KEY ("destinationBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_transferGroupId_fkey" FOREIGN KEY ("transferGroupId") REFERENCES "TransferGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutingNumber" ADD CONSTRAINT "RoutingNumber_financialInstitutionId_fkey" FOREIGN KEY ("financialInstitutionId") REFERENCES "FinancialInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateBankingRelationship" ADD CONSTRAINT "PrivateBankingRelationship_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateBankingRelationship" ADD CONSTRAINT "PrivateBankingRelationship_bankerUserId_fkey" FOREIGN KEY ("bankerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateBankingRelationship" ADD CONSTRAINT "PrivateBankingRelationship_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
