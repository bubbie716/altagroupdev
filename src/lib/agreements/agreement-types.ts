import type { LoanProductType as DbLoanProductType } from "@prisma/client";

/** Officer-entered agreement field values — never auto-trusted from application alone. */
export type AgreementFieldData = {
  borrowerName: string;
  companyName: string;
  loanId: string;
  loanDate: string;
  principalAmount: string;
  interestRateLine: string;
  interestType: string;
  compoundingPeriod: string;
  interestRateVariability: string;
  loanDurationLine: string;
  maturityDate: string;
  repaymentTerms: string;
  firstPaymentDate: string;
  collateral: string;
  latePaymentInterest: string;
  useRestrictions: string;
  bondId: string;
  additionalTerms: string;
  lenderOfficerName: string;
  lenderOfficerTitle: string;
  witnessName: string;
  officerNotes: string;
  internalNotes: string;
};

export type AgreementFieldKey = keyof AgreementFieldData;

export type AgreementChecklistItem = {
  key: AgreementFieldKey;
  label: string;
  required: boolean;
  internalOnly?: boolean;
  complete: boolean;
};

export type AgreementDraftStatusCode =
  | "draft"
  | "awaiting_borrower"
  | "awaiting_bank"
  | "executed"
  | "void"
  | "superseded";

export type AgreementExecutionChecklistItem = {
  key: string;
  label: string;
  complete: boolean;
};

export type AgreementSignatureRow = {
  party: "borrower" | "bank";
  userId: string;
  userName: string;
  signatureName: string;
  discordId: string | null;
  signedAt: string;
  ipAddress: string | null;
};

export type AgreementDraftRow = {
  id: string;
  versionNumber: number;
  status: AgreementDraftStatusCode;
  statusLabel: string;
  pdfSha256: string | null;
  generatedByName: string | null;
  generatedAt: string | null;
  voidedAt: string | null;
  executedAt: string | null;
  downloadUrl: string | null;
  signatures: AgreementSignatureRow[];
  canSignBorrower: boolean;
  canSignBank: boolean;
  canVoid: boolean;
  isReadOnly: boolean;
};

export type AgreementWorkspaceContext = {
  dealRoomId: string;
  templateSlug: string;
  templateLabel: string;
  workspaceLocked: boolean;
  fieldData: AgreementFieldData;
  checklist: AgreementChecklistItem[];
  allRequiredComplete: boolean;
  activeDraft: AgreementDraftRow | null;
  draftHistory: AgreementDraftRow[];
  executedDraft: AgreementDraftRow | null;
  executionChecklist: AgreementExecutionChecklistItem[];
  canEditWorkspace: boolean;
  canGenerate: boolean;
  canCreateNewDraft: boolean;
  previewUrl: string;
};

export type AgreementTemplateDefinition = {
  slug: string;
  label: string;
  templatePath: string;
  productTypes: DbLoanProductType[];
  requiredFields: AgreementFieldKey[];
  /** Maps template placeholder text → formatted value from field data. */
  buildReplacements: (fields: AgreementFieldData) => Record<string, string>;
};

export const AGREEMENT_REQUIRED_FIELDS: AgreementFieldKey[] = [
  "borrowerName",
  "loanId",
  "loanDate",
  "principalAmount",
  "interestRateLine",
  "interestType",
  "loanDurationLine",
  "maturityDate",
  "repaymentTerms",
  "firstPaymentDate",
  "collateral",
  "latePaymentInterest",
  "lenderOfficerName",
  "lenderOfficerTitle",
];

export function emptyAgreementFieldData(): AgreementFieldData {
  return {
    borrowerName: "",
    companyName: "",
    loanId: "",
    loanDate: "",
    principalAmount: "",
    interestRateLine: "",
    interestType: "Simple",
    compoundingPeriod: "N/A",
    interestRateVariability: "Fixed",
    loanDurationLine: "",
    maturityDate: "",
    repaymentTerms: "",
    firstPaymentDate: "",
    collateral: "",
    latePaymentInterest: "",
    useRestrictions: "No restrictions",
    bondId: "N/A - Not Securitised",
    additionalTerms: "",
    lenderOfficerName: "",
    lenderOfficerTitle: "Loan Officer",
    witnessName: "",
    officerNotes: "",
    internalNotes: "",
  };
}

export function buildAgreementChecklist(fields: AgreementFieldData): AgreementChecklistItem[] {
  const labels: Record<AgreementFieldKey, string> = {
    borrowerName: "Borrower",
    companyName: "Company",
    loanId: "Loan ID",
    loanDate: "Loan date",
    principalAmount: "Principal",
    interestRateLine: "Interest rate",
    interestType: "Interest type",
    compoundingPeriod: "Compounding period",
    interestRateVariability: "Rate variability",
    loanDurationLine: "Loan duration",
    maturityDate: "Maturity date",
    repaymentTerms: "Repayment schedule",
    firstPaymentDate: "First payment date",
    collateral: "Collateral",
    latePaymentInterest: "Late payment interest",
    useRestrictions: "Use restrictions",
    bondId: "Bond ID",
    additionalTerms: "Additional terms",
    lenderOfficerName: "Loan officer",
    lenderOfficerTitle: "Officer title",
    witnessName: "Witness",
    officerNotes: "Officer notes",
    internalNotes: "Internal notes",
  };

  const keys = Object.keys(labels) as AgreementFieldKey[];
  return keys.map((key) => ({
    key,
    label: labels[key],
    required: AGREEMENT_REQUIRED_FIELDS.includes(key),
    internalOnly: key === "officerNotes" || key === "internalNotes",
    complete: Boolean(fields[key]?.trim()),
  }));
}

export function suggestAgreementFieldsFromDealRoom(input: {
  borrowerName: string;
  companyName: string | null;
  acceptedPrincipal: number | null;
  acceptedInterestRate: number | null;
  acceptedTermMonths: number | null;
  acceptedCollateralDescription: string | null;
  acceptedSpecialConditions: string | null;
  acceptedPaymentFrequency: string | null;
  loanApplicationId: string | null;
  assignedOfficerName: string | null;
}): Partial<AgreementFieldData> {
  const today = new Date().toISOString().slice(0, 10);
  const term = input.acceptedTermMonths ?? 12;
  const maturity = addMonthsIso(today, term);
  const principal = input.acceptedPrincipal ?? 0;
  const rate = input.acceptedInterestRate ?? 0;

  return {
    borrowerName: input.borrowerName,
    companyName: input.companyName ?? "",
    loanId: input.loanApplicationId?.slice(0, 12).toUpperCase() ?? "",
    loanDate: today,
    principalAmount: principal > 0 ? principal.toFixed(2) : "",
    interestRateLine: rate > 0 ? `${rate.toFixed(2)}% per month` : "",
    interestType: "Simple",
    compoundingPeriod: "N/A",
    interestRateVariability: "Fixed",
    loanDurationLine: term > 0 ? `${term} months from ${today}` : "",
    maturityDate: maturity,
    repaymentTerms: input.acceptedPaymentFrequency ?? "Monthly interest with principal per schedule",
    firstPaymentDate: addMonthsIso(today, 1),
    collateral: input.acceptedCollateralDescription ?? "",
    latePaymentInterest: "0.10",
    useRestrictions: "Loan proceeds per approved facility purpose",
    bondId: "N/A - Not Securitised",
    additionalTerms: input.acceptedSpecialConditions ?? "",
    lenderOfficerName: input.assignedOfficerName ?? "",
    lenderOfficerTitle: "Loan Officer · Alta Bank",
  };
}

function addMonthsIso(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export type SaveAgreementWorkspaceInput = {
  dealRoomId: string;
  fieldData: AgreementFieldData;
};

export type SignAgreementInput = {
  draftId: string;
  signatureName: string;
  confirmed: boolean;
};
