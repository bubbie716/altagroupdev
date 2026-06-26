-- Deal Room operations: workflow stages, tasks, notifications, SLA

CREATE TYPE "DealRoomWorkflowStage" AS ENUM (
  'APPLICATION_RECEIVED',
  'INITIAL_REVIEW',
  'DOCUMENT_COLLECTION',
  'UNDERWRITING',
  'NEGOTIATING_TERMS',
  'AGREEMENT_PREPARATION',
  'AWAITING_BORROWER_SIGNATURE',
  'AWAITING_ALTA_SIGNATURE',
  'FUNDING',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
  'DECLINED',
  'EXPIRED'
);

CREATE TYPE "DealRoomPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "DealRoomTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "UserNotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'DISCORD');
CREATE TYPE "UserNotificationType" AS ENUM (
  'DEAL_ROOM_CREATED',
  'DEAL_ROOM_OFFICER_ASSIGNED',
  'DEAL_ROOM_MESSAGE_RECEIVED',
  'DEAL_ROOM_DOCUMENT_REQUESTED',
  'DEAL_ROOM_DOCUMENT_UPLOADED',
  'DEAL_ROOM_OFFER_RECEIVED',
  'DEAL_ROOM_AGREEMENT_READY',
  'DEAL_ROOM_BORROWER_SIGNED',
  'DEAL_ROOM_FUNDING_COMPLETE',
  'DEAL_ROOM_TASK_ASSIGNED',
  'DEAL_ROOM_TASK_DUE',
  'DEAL_ROOM_TASK_OVERDUE',
  'DEAL_ROOM_STAGE_CHANGED'
);

ALTER TABLE "DealRoom" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "DealRoom" ADD COLUMN "assignedTeamLabel" TEXT NOT NULL DEFAULT 'Lending Desk';
ALTER TABLE "DealRoom" ADD COLUMN "workflowStage" "DealRoomWorkflowStage" NOT NULL DEFAULT 'APPLICATION_RECEIVED';
ALTER TABLE "DealRoom" ADD COLUMN "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DealRoom" ADD COLUMN "priority" "DealRoomPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "DealRoom" ADD COLUMN "slaOfficerFirstResponseAt" TIMESTAMP(3);
ALTER TABLE "DealRoom" ADD COLUMN "slaDocumentsRequestedAt" TIMESTAMP(3);
ALTER TABLE "DealRoom" ADD COLUMN "slaDocumentsReceivedAt" TIMESTAMP(3);
ALTER TABLE "DealRoom" ADD COLUMN "slaAgreementGeneratedAt" TIMESTAMP(3);
ALTER TABLE "DealRoom" ADD COLUMN "slaBorrowerSignedAt" TIMESTAMP(3);
ALTER TABLE "DealRoom" ADD COLUMN "slaBankSignedAt" TIMESTAMP(3);
ALTER TABLE "DealRoom" ADD COLUMN "slaFundingCompletedAt" TIMESTAMP(3);
ALTER TABLE "DealRoom" ADD COLUMN "stalledAt" TIMESTAMP(3);

CREATE TABLE "DealRoomTask" (
  "id" TEXT NOT NULL,
  "dealRoomId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assignedToUserId" TEXT,
  "priority" "DealRoomPriority" NOT NULL DEFAULT 'MEDIUM',
  "dueDate" TIMESTAMP(3),
  "status" "DealRoomTaskStatus" NOT NULL DEFAULT 'OPEN',
  "createdByUserId" TEXT NOT NULL,
  "completedByUserId" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DealRoomTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealRoomStageHistory" (
  "id" TEXT NOT NULL,
  "dealRoomId" TEXT NOT NULL,
  "stage" "DealRoomWorkflowStage" NOT NULL,
  "ownerUserId" TEXT,
  "changedByUserId" TEXT,
  "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "exitedAt" TIMESTAMP(3),
  CONSTRAINT "DealRoomStageHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "UserNotificationType" NOT NULL,
  "channel" "UserNotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "linkUrl" TEXT,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DealRoom_workflowStage_idx" ON "DealRoom"("workflowStage");
CREATE INDEX "DealRoom_priority_idx" ON "DealRoom"("priority");
CREATE INDEX "DealRoom_stageEnteredAt_idx" ON "DealRoom"("stageEnteredAt");
CREATE INDEX "DealRoomTask_dealRoomId_idx" ON "DealRoomTask"("dealRoomId");
CREATE INDEX "DealRoomTask_assignedToUserId_idx" ON "DealRoomTask"("assignedToUserId");
CREATE INDEX "DealRoomTask_status_idx" ON "DealRoomTask"("status");
CREATE INDEX "DealRoomTask_dueDate_idx" ON "DealRoomTask"("dueDate");
CREATE INDEX "DealRoomStageHistory_dealRoomId_idx" ON "DealRoomStageHistory"("dealRoomId");
CREATE INDEX "DealRoomStageHistory_stage_idx" ON "DealRoomStageHistory"("stage");
CREATE INDEX "DealRoomStageHistory_enteredAt_idx" ON "DealRoomStageHistory"("enteredAt");
CREATE INDEX "UserNotification_userId_readAt_idx" ON "UserNotification"("userId", "readAt");
CREATE INDEX "UserNotification_createdAt_idx" ON "UserNotification"("createdAt");

ALTER TABLE "DealRoom" ADD CONSTRAINT "DealRoom_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DealRoomTask" ADD CONSTRAINT "DealRoomTask_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealRoomTask" ADD CONSTRAINT "DealRoomTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DealRoomTask" ADD CONSTRAINT "DealRoomTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealRoomTask" ADD CONSTRAINT "DealRoomTask_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DealRoomStageHistory" ADD CONSTRAINT "DealRoomStageHistory_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealRoomStageHistory" ADD CONSTRAINT "DealRoomStageHistory_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DealRoomStageHistory" ADD CONSTRAINT "DealRoomStageHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill workflow stages from existing status
UPDATE "DealRoom" SET "workflowStage" = 'INITIAL_REVIEW' WHERE "status" = 'UNDER_REVIEW';
UPDATE "DealRoom" SET "workflowStage" = 'NEGOTIATING_TERMS' WHERE "status" = 'NEGOTIATING_TERMS';
UPDATE "DealRoom" SET "workflowStage" = 'DOCUMENT_COLLECTION' WHERE "status" = 'AWAITING_APPLICANT';
UPDATE "DealRoom" SET "workflowStage" = 'UNDERWRITING' WHERE "status" = 'AWAITING_OFFICER';
UPDATE "DealRoom" SET "workflowStage" = 'AGREEMENT_PREPARATION' WHERE "status" IN ('CONTRACT_DRAFTING', 'ACCEPTED');
UPDATE "DealRoom" SET "workflowStage" = 'AWAITING_BORROWER_SIGNATURE' WHERE "status" = 'READY_FOR_ACCEPTANCE';
UPDATE "DealRoom" SET "workflowStage" = 'FUNDING' WHERE "status" = 'APPROVED';
UPDATE "DealRoom" SET "workflowStage" = 'COMPLETED' WHERE "status" = 'EXECUTED';
UPDATE "DealRoom" SET "workflowStage" = 'DECLINED' WHERE "status" = 'DECLINED';
UPDATE "DealRoom" SET "workflowStage" = 'CANCELLED' WHERE "status" = 'CLOSED';
