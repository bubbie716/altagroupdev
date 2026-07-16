-- NCC Sprint 3B — Institution API, Credentials & Signed Webhooks

ALTER TYPE "AuditEntityType" ADD VALUE 'NCC_API_CREDENTIAL';
ALTER TYPE "AuditEntityType" ADD VALUE 'NCC_WEBHOOK_ENDPOINT';
ALTER TYPE "AuditEntityType" ADD VALUE 'NCC_WEBHOOK_EVENT';
ALTER TYPE "AuditEntityType" ADD VALUE 'NCC_WEBHOOK_DELIVERY';
ALTER TYPE "AuditEntityType" ADD VALUE 'NCC_API_REQUEST_LOG';
ALTER TYPE "AuditEntityType" ADD VALUE 'NCC_REVERSAL_REQUEST';

CREATE TYPE "NccApiCredentialStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'ROTATED');
CREATE TYPE "NccApiEnvironment" AS ENUM ('TEST', 'LIVE');
CREATE TYPE "NccWebhookEndpointStatus" AS ENUM ('ACTIVE', 'DISABLED', 'FAILING', 'REVOKED');
CREATE TYPE "NccWebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERING', 'DELIVERED', 'RETRY_PENDING', 'FAILED', 'CANCELLED');
CREATE TYPE "NccReversalRequestStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "NccApiCredential" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" "NccApiEnvironment" NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" "NccApiCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "rotatedFromCredentialId" TEXT,
    "metadata" JSONB,
    CONSTRAINT "NccApiCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NccApiCredential_institutionId_name_key" ON "NccApiCredential"("institutionId", "name");
CREATE UNIQUE INDEX "NccApiCredential_keyPrefix_key" ON "NccApiCredential"("keyPrefix");
CREATE INDEX "NccApiCredential_institutionId_status_idx" ON "NccApiCredential"("institutionId", "status");
CREATE INDEX "NccApiCredential_environment_status_idx" ON "NccApiCredential"("environment", "status");
CREATE INDEX "NccApiCredential_expiresAt_idx" ON "NccApiCredential"("expiresAt");

ALTER TABLE "NccApiCredential" ADD CONSTRAINT "NccApiCredential_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NccApiCredential" ADD CONSTRAINT "NccApiCredential_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NccWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "environment" "NccApiEnvironment" NOT NULL,
    "status" "NccWebhookEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscribedEvents" TEXT[],
    "signingSecretEncrypted" TEXT NOT NULL,
    "secretPrefix" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "metadata" JSONB,
    CONSTRAINT "NccWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NccWebhookEndpoint_institutionId_name_key" ON "NccWebhookEndpoint"("institutionId", "name");
CREATE INDEX "NccWebhookEndpoint_institutionId_status_idx" ON "NccWebhookEndpoint"("institutionId", "status");
CREATE INDEX "NccWebhookEndpoint_environment_status_idx" ON "NccWebhookEndpoint"("environment", "status");

ALTER TABLE "NccWebhookEndpoint" ADD CONSTRAINT "NccWebhookEndpoint_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NccWebhookEndpoint" ADD CONSTRAINT "NccWebhookEndpoint_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NccWebhookEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "environment" "NccApiEnvironment" NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectReference" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outboxEventId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    CONSTRAINT "NccWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NccWebhookEvent_dedupeKey_key" ON "NccWebhookEvent"("dedupeKey");
CREATE INDEX "NccWebhookEvent_institutionId_createdAt_idx" ON "NccWebhookEvent"("institutionId", "createdAt");
CREATE INDEX "NccWebhookEvent_eventType_createdAt_idx" ON "NccWebhookEvent"("eventType", "createdAt");
CREATE INDEX "NccWebhookEvent_outboxEventId_idx" ON "NccWebhookEvent"("outboxEventId");

ALTER TABLE "NccWebhookEvent" ADD CONSTRAINT "NccWebhookEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "NccWebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookEventId" TEXT NOT NULL,
    "webhookEndpointId" TEXT NOT NULL,
    "status" "NccWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INT NOT NULL DEFAULT 0,
    "maxAttempts" INT NOT NULL DEFAULT 12,
    "nextAttemptAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "responseStatus" INT,
    "responseSnippet" TEXT,
    "latencyMs" INT,
    "lastErrorCode" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NccWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NccWebhookDelivery_webhookEventId_webhookEndpointId_key" ON "NccWebhookDelivery"("webhookEventId", "webhookEndpointId");
CREATE INDEX "NccWebhookDelivery_status_nextAttemptAt_idx" ON "NccWebhookDelivery"("status", "nextAttemptAt");
CREATE INDEX "NccWebhookDelivery_webhookEndpointId_createdAt_idx" ON "NccWebhookDelivery"("webhookEndpointId", "createdAt");

ALTER TABLE "NccWebhookDelivery" ADD CONSTRAINT "NccWebhookDelivery_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "NccWebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NccWebhookDelivery" ADD CONSTRAINT "NccWebhookDelivery_webhookEndpointId_fkey" FOREIGN KEY ("webhookEndpointId") REFERENCES "NccWebhookEndpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "NccApiRequestLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "credentialId" TEXT,
    "environment" "NccApiEnvironment" NOT NULL,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "responseStatus" INT NOT NULL,
    "errorCode" TEXT,
    "latencyMs" INT NOT NULL,
    "idempotencyKeyPrefix" TEXT,
    "sourceIpHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NccApiRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NccApiRequestLog_requestId_key" ON "NccApiRequestLog"("requestId");
CREATE INDEX "NccApiRequestLog_institutionId_createdAt_idx" ON "NccApiRequestLog"("institutionId", "createdAt");
CREATE INDEX "NccApiRequestLog_credentialId_createdAt_idx" ON "NccApiRequestLog"("credentialId", "createdAt");
CREATE INDEX "NccApiRequestLog_createdAt_idx" ON "NccApiRequestLog"("createdAt");

ALTER TABLE "NccApiRequestLog" ADD CONSTRAINT "NccApiRequestLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NccApiRequestLog" ADD CONSTRAINT "NccApiRequestLog_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "NccApiCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NccApiRateLimitBucket" (
    "id" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INT NOT NULL DEFAULT 0,
    "institutionId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NccApiRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NccApiRateLimitBucket_bucketKey_windowStart_key" ON "NccApiRateLimitBucket"("bucketKey", "windowStart");
CREATE INDEX "NccApiRateLimitBucket_windowStart_idx" ON "NccApiRateLimitBucket"("windowStart");
CREATE INDEX "NccApiRateLimitBucket_institutionId_idx" ON "NccApiRateLimitBucket"("institutionId");

ALTER TABLE "NccApiRateLimitBucket" ADD CONSTRAINT "NccApiRateLimitBucket_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NccSettlementReversalRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "settlementInstructionId" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "NccReversalRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "requestedByCredentialId" TEXT,
    "requestedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "NccSettlementReversalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NccSettlementReversalRequest_institutionId_status_idx" ON "NccSettlementReversalRequest"("institutionId", "status");
CREATE INDEX "NccSettlementReversalRequest_settlementInstructionId_idx" ON "NccSettlementReversalRequest"("settlementInstructionId");
CREATE INDEX "NccSettlementReversalRequest_status_createdAt_idx" ON "NccSettlementReversalRequest"("status", "createdAt");

ALTER TABLE "NccSettlementReversalRequest" ADD CONSTRAINT "NccSettlementReversalRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "FinancialInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NccSettlementReversalRequest" ADD CONSTRAINT "NccSettlementReversalRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
