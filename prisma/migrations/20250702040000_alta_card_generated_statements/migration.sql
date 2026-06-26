-- Allow user-generated preview Alta Card statements (Statement Center parity).
ALTER TYPE "AltaCardStatementStatus" ADD VALUE 'GENERATED' BEFORE 'ISSUED';
