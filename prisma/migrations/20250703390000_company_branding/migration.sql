-- CreateTable
CREATE TABLE "CompanyBranding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "logoPathname" TEXT,
    "brandColor" TEXT,
    "accentColor" TEXT,
    "invoiceFooterText" TEXT,
    "paymentLinkFooterText" TEXT,
    "supportEmail" TEXT,
    "supportDiscord" TEXT,
    "websiteUrl" TEXT,
    "displayNameOverride" TEXT,
    "showPoweredByAlta" BOOLEAN NOT NULL DEFAULT true,
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyBranding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyBranding_companyId_key" ON "CompanyBranding"("companyId");

-- AddForeignKey
ALTER TABLE "CompanyBranding" ADD CONSTRAINT "CompanyBranding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
