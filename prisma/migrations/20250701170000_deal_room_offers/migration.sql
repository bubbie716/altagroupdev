-- CreateEnum
CREATE TYPE "DealRoomOfferType" AS ENUM ('APPLICANT_COUNTER', 'OFFICER_OFFER', 'SYSTEM_GENERATED');

-- CreateEnum
CREATE TYPE "DealRoomOfferStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- AlterTable
ALTER TABLE "DealRoom" ADD COLUMN     "acceptedPrincipal" DECIMAL(18,2),
ADD COLUMN     "acceptedInterestRate" DECIMAL(8,4),
ADD COLUMN     "acceptedTermMonths" INTEGER,
ADD COLUMN     "acceptedMinimumPayment" DECIMAL(18,2),
ADD COLUMN     "acceptedPaymentFrequency" TEXT,
ADD COLUMN     "acceptedCollateralDescription" TEXT,
ADD COLUMN     "acceptedSpecialConditions" TEXT,
ADD COLUMN     "acceptedOfferId" TEXT,
ADD COLUMN     "acceptedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DealRoomOffer" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "offerType" "DealRoomOfferType" NOT NULL,
    "status" "DealRoomOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "proposedPrincipal" DECIMAL(18,2) NOT NULL,
    "proposedInterestRate" DECIMAL(8,4) NOT NULL,
    "proposedTermMonths" INTEGER NOT NULL,
    "proposedMinimumPayment" DECIMAL(18,2),
    "proposedPaymentFrequency" TEXT,
    "collateralDescription" TEXT,
    "specialConditions" TEXT,
    "rejectionNote" TEXT,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealRoomOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealRoom_acceptedOfferId_key" ON "DealRoom"("acceptedOfferId");

-- CreateIndex
CREATE INDEX "DealRoomOffer_dealRoomId_createdAt_idx" ON "DealRoomOffer"("dealRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "DealRoomOffer_dealRoomId_status_idx" ON "DealRoomOffer"("dealRoomId", "status");

-- CreateIndex
CREATE INDEX "DealRoomOffer_createdByUserId_idx" ON "DealRoomOffer"("createdByUserId");

-- AddForeignKey
ALTER TABLE "DealRoom" ADD CONSTRAINT "DealRoom_acceptedOfferId_fkey" FOREIGN KEY ("acceptedOfferId") REFERENCES "DealRoomOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomOffer" ADD CONSTRAINT "DealRoomOffer_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomOffer" ADD CONSTRAINT "DealRoomOffer_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
