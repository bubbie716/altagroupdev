-- AlterEnum: customer DMs for bank account open + terminal portfolio create
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'BANK_ACCOUNT_OPENED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'TERMINAL_PORTFOLIO_CREATED';
