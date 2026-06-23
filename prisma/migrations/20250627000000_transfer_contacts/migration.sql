-- CreateEnum
CREATE TYPE "TransferContactScope" AS ENUM ('INTRABANK', 'INTERBANK');

-- CreateEnum
CREATE TYPE "IntrabankContactKind" AS ENUM ('OWN_ACCOUNT', 'PLAYER_ACCOUNT');

-- CreateTable
CREATE TABLE "TransferContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "TransferContactScope" NOT NULL,
    "label" TEXT NOT NULL,
    "intrabankKind" "IntrabankContactKind",
    "bankAccountId" TEXT,
    "accountNumber" TEXT,
    "resolvedName" TEXT,
    "recipientInstitution" TEXT,
    "recipientName" TEXT,
    "routingNumber" TEXT,
    "wireAccountNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransferContact_userId_scope_idx" ON "TransferContact"("userId", "scope");

-- AddForeignKey
ALTER TABLE "TransferContact" ADD CONSTRAINT "TransferContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferContact" ADD CONSTRAINT "TransferContact_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
