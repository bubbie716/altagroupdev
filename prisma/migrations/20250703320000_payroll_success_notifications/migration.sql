-- Payroll run success/failure customer notifications and audit entity type
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'PAYROLL_RUN';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'PAYROLL_RUN_EXECUTED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'PAYROLL_RUN_FAILED';
