-- CreateEnum
CREATE TYPE "LoanProductType" AS ENUM ('PERSONAL_CREDIT_LINE', 'BUSINESS_CREDIT_LINE', 'PRIVATE_LIQUIDITY_LINE');
CREATE TYPE "LoanApplicationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'CANCELLED');
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'PAID_OFF', 'DEFAULTED', 'CANCELLED', 'FROZEN');
CREATE TYPE "LoanPaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "companyId" TEXT,
    "productType" "LoanProductType" NOT NULL,
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "purpose" TEXT NOT NULL,
    "repaymentPlan" TEXT NOT NULL,
    "collateralDescription" TEXT,
    "notes" TEXT,
    "linkedBankAccountId" TEXT,
    "status" "LoanApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "loanApplicationId" TEXT NOT NULL,
    "borrowerUserId" TEXT,
    "companyId" TEXT,
    "productType" "LoanProductType" NOT NULL,
    "principalAmount" DECIMAL(18,2) NOT NULL,
    "outstandingBalance" DECIMAL(18,2) NOT NULL,
    "interestRate" DECIMAL(8,4) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "linkedBankAccountId" TEXT,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanPayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "sourceBankAccountId" TEXT,
    "status" "LoanPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoanApplication_applicantUserId_idx" ON "LoanApplication"("applicantUserId");
CREATE INDEX "LoanApplication_companyId_idx" ON "LoanApplication"("companyId");
CREATE INDEX "LoanApplication_status_idx" ON "LoanApplication"("status");
CREATE INDEX "LoanApplication_productType_idx" ON "LoanApplication"("productType");
CREATE INDEX "LoanApplication_createdAt_idx" ON "LoanApplication"("createdAt");
CREATE UNIQUE INDEX "Loan_loanApplicationId_key" ON "Loan"("loanApplicationId");
CREATE INDEX "Loan_borrowerUserId_idx" ON "Loan"("borrowerUserId");
CREATE INDEX "Loan_companyId_idx" ON "Loan"("companyId");
CREATE INDEX "Loan_status_idx" ON "Loan"("status");
CREATE INDEX "Loan_productType_idx" ON "Loan"("productType");
CREATE INDEX "LoanPayment_loanId_idx" ON "LoanPayment"("loanId");
CREATE INDEX "LoanPayment_status_idx" ON "LoanPayment"("status");

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_linkedBankAccountId_fkey" FOREIGN KEY ("linkedBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_borrowerUserId_fkey" FOREIGN KEY ("borrowerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_linkedBankAccountId_fkey" FOREIGN KEY ("linkedBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_sourceBankAccountId_fkey" FOREIGN KEY ("sourceBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
