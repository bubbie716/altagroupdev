export type DealRoomExecutionSummary = {
  isExecuted: boolean;
  executedAt: string | null;
  loanId: string | null;
  agreementId: string | null;
  agreementDraftId: string | null;
  agreementVersion: number | null;
  agreementDownloadUrl: string | null;
  agreementSha256: string | null;
  disbursementReference: string | null;
  fundingAccountId: string | null;
  fundingAccountLabel: string | null;
  officerId: string | null;
  officerName: string | null;
  borrowerName: string | null;
  principal: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  nextDueDate: string | null;
  productLabel: string;
  userLoanUrl: string;
  internalLoanUrl: string | null;
};

export type LoanExecutionResult = {
  loanId: string;
  dealRoomId: string;
  agreementId: string;
  agreementDraftId: string;
  disbursementReferenceCode: string | null;
  fundingBankAccountId: string | null;
  scheduleInstallmentCount: number;
  firstPaymentDueDate: string;
};
