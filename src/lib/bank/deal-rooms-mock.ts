export type DealRoomStatus =
  | "under_review"
  | "negotiating"
  | "awaiting_applicant"
  | "awaiting_officer"
  | "contract_drafting"
  | "ready_for_signature"
  | "approved"
  | "declined"
  | "closed";

export const DEAL_ROOM_STATUS_LABELS: Record<DealRoomStatus, string> = {
  under_review: "Under Review",
  negotiating: "Negotiating Terms",
  awaiting_applicant: "Awaiting Applicant",
  awaiting_officer: "Awaiting Officer",
  contract_drafting: "Contract Drafting",
  ready_for_signature: "Ready for Signature",
  approved: "Approved",
  declined: "Declined",
  closed: "Closed",
};

export const DEAL_ROOM_STATUS_TONES: Record<DealRoomStatus, "info" | "warn" | "positive" | "negative" | "muted"> = {
  under_review: "info",
  negotiating: "warn",
  awaiting_applicant: "warn",
  awaiting_officer: "warn",
  contract_drafting: "info",
  ready_for_signature: "positive",
  approved: "positive",
  declined: "negative",
  closed: "muted",
};

export type DealActivityKind =
  | "system"
  | "applicant_message"
  | "officer_message"
  | "term_sheet"
  | "counterproposal"
  | "document_request"
  | "contract_draft"
  | "approval"
  | "decline";

export interface DealActivityItem {
  id: string;
  kind: DealActivityKind;
  actor: string;
  actorRole: "Applicant" | "Loan Officer" | "System" | "Underwriter";
  timestamp: string;
  title: string;
  body?: string;
}

export interface DealTerms {
  amount: number;
  monthlyRate: number;
  termMonths: number;
  paymentStructure: string;
}

export interface DealRoomTimelineStep {
  id: string;
  label: string;
  state: "complete" | "current" | "upcoming";
  date?: string;
}

export interface DealRoomContract {
  status: "drafting" | "ready_for_review" | "awaiting_acceptance" | "accepted" | "finalized";
  version: string;
  effectiveDate: string | null;
  collateralNotes: string;
  specialConditions: string[];
}

export interface DealRoom {
  id: string;
  product: string;
  productCode: "personal_credit_line" | "business_credit_line" | "private_liquidity_line";
  applicant: string;
  applicantHandle: string;
  company: string | null;
  officer: string;
  officerTitle: string;
  status: DealRoomStatus;
  createdAt: string;
  lastActivityAt: string;
  lastActivityLabel: string;
  nextAction: string;
  nextActor: "Applicant" | "Officer" | "Underwriter" | "None";
  requested: DealTerms;
  proposed: DealTerms;
  proposedMonthlyPayment: number;
  activity: DealActivityItem[];
  timeline: DealRoomTimelineStep[];
  contract: DealRoomContract;
  requiredActions: { id: string; label: string; due: string }[];
}

const DEAL_ROOMS: DealRoom[] = [
  {
    id: "DR-2041",
    product: "Business Credit Line",
    productCode: "business_credit_line",
    applicant: "Mara Olsen",
    applicantHandle: "@mara",
    company: "Halcyon Freight Co.",
    officer: "Alex Morgan",
    officerTitle: "Senior Loan Officer",
    status: "negotiating",
    createdAt: "2026-06-14T09:12:00Z",
    lastActivityAt: "2026-06-24T16:04:00Z",
    lastActivityLabel: "2 hours ago",
    nextAction: "Awaiting Applicant Response",
    nextActor: "Applicant",
    requested: { amount: 4_500_000, monthlyRate: 5.5, termMonths: 8, paymentStructure: "Equal monthly installments" },
    proposed: { amount: 3_750_000, monthlyRate: 6.0, termMonths: 8, paymentStructure: "Equal monthly installments" },
    proposedMonthlyPayment: 693_750,
    activity: [
      { id: "a1", kind: "system", actor: "Alta Bank", actorRole: "System", timestamp: "2026-06-14T09:12:00Z", title: "Application submitted", body: "Business Credit Line request for ƒ4,500,000 received from Halcyon Freight Co." },
      { id: "a2", kind: "system", actor: "Credit Desk", actorRole: "System", timestamp: "2026-06-14T11:30:00Z", title: "Loan officer assigned", body: "Alex Morgan assigned as primary relationship officer." },
      { id: "a3", kind: "document_request", actor: "Alex Morgan", actorRole: "Loan Officer", timestamp: "2026-06-15T14:02:00Z", title: "Additional information requested", body: "Please provide Q1 and Q2 operating statements and a list of receivables over 60 days." },
      { id: "a4", kind: "applicant_message", actor: "Mara Olsen", actorRole: "Applicant", timestamp: "2026-06-17T10:11:00Z", title: "Documents submitted", body: "Uploaded operating statements and receivables aging report. Available for any follow-up." },
      { id: "a5", kind: "term_sheet", actor: "Alex Morgan", actorRole: "Loan Officer", timestamp: "2026-06-22T15:45:00Z", title: "Term sheet issued · v1", body: "Proposed facility of ƒ3,750,000 at 6.0% monthly, 8-month equal-installment repayment." },
      { id: "a6", kind: "counterproposal", actor: "Mara Olsen", actorRole: "Applicant", timestamp: "2026-06-24T11:15:00Z", title: "Counterproposal submitted", body: "Requesting full ƒ4,500,000 facility; willing to accept 6.0% monthly and shorten term to 6 months." },
      { id: "a7", kind: "officer_message", actor: "Alex Morgan", actorRole: "Loan Officer", timestamp: "2026-06-24T16:04:00Z", title: "Reviewing counterproposal", body: "Counterproposal under review with the credit committee. Decision expected within 24 hours." },
    ],
    timeline: [
      { id: "t1", label: "Application Submitted", state: "complete", date: "Jun 14" },
      { id: "t2", label: "Officer Assigned", state: "complete", date: "Jun 14" },
      { id: "t3", label: "Negotiation Started", state: "complete", date: "Jun 22" },
      { id: "t4", label: "Term Sheet Issued", state: "current", date: "Jun 22" },
      { id: "t5", label: "Terms Accepted", state: "upcoming" },
      { id: "t6", label: "Contract Generated", state: "upcoming" },
      { id: "t7", label: "Contract Accepted", state: "upcoming" },
      { id: "t8", label: "Disbursement", state: "upcoming" },
    ],
    contract: {
      status: "drafting",
      version: "v1.2",
      effectiveDate: null,
      collateralNotes: "Blanket lien on receivables; corporate guarantee from Halcyon Freight Co.",
      specialConditions: [
        "Monthly financial reporting required",
        "Minimum operating account balance of ƒ250,000",
        "Prepayment permitted without penalty",
      ],
    },
    requiredActions: [
      { id: "r1", label: "Respond to counterproposal", due: "Jun 25" },
      { id: "r2", label: "Confirm collateral schedule", due: "Jun 27" },
    ],
  },
  {
    id: "DR-2039",
    product: "Private Liquidity Line",
    productCode: "private_liquidity_line",
    applicant: "Jonas Reeve",
    applicantHandle: "@jreeve",
    company: null,
    officer: "Priya Anand",
    officerTitle: "Private Credit Desk",
    status: "ready_for_signature",
    createdAt: "2026-06-01T08:00:00Z",
    lastActivityAt: "2026-06-23T18:20:00Z",
    lastActivityLabel: "Yesterday",
    nextAction: "Awaiting Applicant Signature",
    nextActor: "Applicant",
    requested: { amount: 15_000_000, monthlyRate: 0, termMonths: 24, paymentStructure: "Interest-only, balloon principal" },
    proposed: { amount: 15_000_000, monthlyRate: 3.25, termMonths: 24, paymentStructure: "Interest-only, balloon principal" },
    proposedMonthlyPayment: 487_500,
    activity: [
      { id: "a1", kind: "system", actor: "Alta Bank", actorRole: "System", timestamp: "2026-06-01T08:00:00Z", title: "Application submitted" },
      { id: "a2", kind: "system", actor: "Private Desk", actorRole: "System", timestamp: "2026-06-01T09:30:00Z", title: "Loan officer assigned", body: "Priya Anand assigned. Relationship classified as Alta Private." },
      { id: "a3", kind: "term_sheet", actor: "Priya Anand", actorRole: "Loan Officer", timestamp: "2026-06-18T13:00:00Z", title: "Term sheet issued · v2", body: "Negotiated facility of ƒ15,000,000 at 3.25% monthly, 24-month interest-only with balloon." },
      { id: "a4", kind: "applicant_message", actor: "Jonas Reeve", actorRole: "Applicant", timestamp: "2026-06-21T10:00:00Z", title: "Terms accepted", body: "Confirmed acceptance of v2 term sheet. Proceed with contract package." },
      { id: "a5", kind: "contract_draft", actor: "Priya Anand", actorRole: "Loan Officer", timestamp: "2026-06-23T18:20:00Z", title: "Contract package ready for signature", body: "Final contract package issued; awaiting applicant signature." },
    ],
    timeline: [
      { id: "t1", label: "Application Submitted", state: "complete", date: "Jun 1" },
      { id: "t2", label: "Officer Assigned", state: "complete", date: "Jun 1" },
      { id: "t3", label: "Negotiation Started", state: "complete", date: "Jun 8" },
      { id: "t4", label: "Term Sheet Issued", state: "complete", date: "Jun 18" },
      { id: "t5", label: "Terms Accepted", state: "complete", date: "Jun 21" },
      { id: "t6", label: "Contract Generated", state: "complete", date: "Jun 23" },
      { id: "t7", label: "Contract Accepted", state: "current" },
      { id: "t8", label: "Disbursement", state: "upcoming" },
    ],
    contract: {
      status: "awaiting_acceptance",
      version: "v2.0",
      effectiveDate: "2026-07-01",
      collateralNotes: "Pledged portfolio assets held in Alta custody, minimum 200% coverage ratio.",
      specialConditions: [
        "Quarterly portfolio mark-to-market",
        "Margin call at 150% coverage",
        "Renewal option after 12 months",
      ],
    },
    requiredActions: [
      { id: "r1", label: "Sign contract package", due: "Jun 30" },
    ],
  },
  {
    id: "DR-2030",
    product: "Personal Credit Line",
    productCode: "personal_credit_line",
    applicant: "Tomás Vela",
    applicantHandle: "@tvela",
    company: null,
    officer: "Alex Morgan",
    officerTitle: "Senior Loan Officer",
    status: "under_review",
    createdAt: "2026-06-20T12:00:00Z",
    lastActivityAt: "2026-06-22T09:00:00Z",
    lastActivityLabel: "2 days ago",
    nextAction: "Underwriting review in progress",
    nextActor: "Underwriter",
    requested: { amount: 750_000, monthlyRate: 7.5, termMonths: 6, paymentStructure: "Minimum 10% monthly" },
    proposed: { amount: 0, monthlyRate: 0, termMonths: 0, paymentStructure: "Pending" },
    proposedMonthlyPayment: 0,
    activity: [
      { id: "a1", kind: "system", actor: "Alta Bank", actorRole: "System", timestamp: "2026-06-20T12:00:00Z", title: "Application submitted" },
      { id: "a2", kind: "system", actor: "Credit Desk", actorRole: "System", timestamp: "2026-06-20T14:30:00Z", title: "Loan officer assigned" },
      { id: "a3", kind: "officer_message", actor: "Alex Morgan", actorRole: "Loan Officer", timestamp: "2026-06-22T09:00:00Z", title: "Initial review started", body: "Reviewing income verification and existing Alta account history." },
    ],
    timeline: [
      { id: "t1", label: "Application Submitted", state: "complete", date: "Jun 20" },
      { id: "t2", label: "Officer Assigned", state: "complete", date: "Jun 20" },
      { id: "t3", label: "Negotiation Started", state: "current" },
      { id: "t4", label: "Term Sheet Issued", state: "upcoming" },
      { id: "t5", label: "Terms Accepted", state: "upcoming" },
      { id: "t6", label: "Contract Generated", state: "upcoming" },
      { id: "t7", label: "Contract Accepted", state: "upcoming" },
      { id: "t8", label: "Disbursement", state: "upcoming" },
    ],
    contract: {
      status: "drafting",
      version: "—",
      effectiveDate: null,
      collateralNotes: "Unsecured personal facility.",
      specialConditions: [],
    },
    requiredActions: [
      { id: "r1", label: "Submit pay history (last 3 months)", due: "Jun 28" },
    ],
  },
];

export function listDealRooms(): DealRoom[] {
  return DEAL_ROOMS;
}

export function getDealRoom(id: string): DealRoom | undefined {
  return DEAL_ROOMS.find((d) => d.id === id);
}