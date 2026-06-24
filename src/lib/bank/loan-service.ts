/** Public API surface for Alta Bank loan service (implementation in server/loan.service.ts). */
export {
  approveLoanApplication,
  denyLoanApplication,
  makeLoanPayment,
  setLoanAutoPay,
  executeDueLoanAutoPayments,
  accrueInterestForLoan,
  accrueInterestForDueLoans,
  accrueInterestCatchUpForLoan,
  backfillLegacyLoanInterest,
  getUserLoans,
  getLoanDetail,
  getLoanPaymentContext,
  freezeLoan,
  unfreezeLoan,
  markLoanPaidOff,
  adminAdjustLoanBalance,
  listInternalLoansByStatus,
} from "@/server/loan.service";

export { monthlyRateFromAnnual, computeMonthlyInterestCharge, formatInterestRateLabel, estimateOutstandingAfterTerm } from "@/lib/bank/loan-interest";
