/**
 * Mock data for the Secure Deal Room. UI-only; no backend wiring.
 * Replace with Prisma-backed queries when the lending workspace ships.
 */

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

export type DealRoomStatusTone = "neutral" | "active" | "warn" | "success" | "danger" | "muted";

export const DEAL_ROOM_STATUS_TONE: Record<DealRoomStatus, DealRoomStatusTone> = {
  under_review: "neutral",
  negotiating: "active",
  awaiting_applicant: "warn",
  awaiting_officer: "warn",
  contract_drafting: "active",
  ready_for_signature: "success",
  approved: "success",
  declined: "danger",
  closed: "muted",
};

export type ActivityKind =
  | "applicant_message"
  | "officer_message"
  | "system";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  body?: string;
  author?: string;
  authorRole?: string;
  timestamp: string;
}

/* -------------------------------------------------------------------------- */
/* Chat messages (agent-chat shape, separate from activity log)               */
/* -------------------------------------------------------------------------- */

export type ChatRole = "officer" | "applicant" | "system";

export type ChatPart =
  | { type: "text"; text: string }
  | {
      type: "term-sheet-card";
      version: number;
      amount: number;
      rate: number;
      termMonths: number;
      minPayment: number;
    }
  | {
      type: "document-request-card";
      docs: string[];
    }
  | {
      type: "status-card";
      label: string;
      detail?: string;
    }
  | {
      type: "signature-card";
      title: string;
      detail?: string;
    };

export interface ChatMessage {
  id: string;
  role: ChatRole;
  author?: string;
  authorRole?: string;
  timestamp: string;
  parts: ChatPart[];
}

export type ContractStatus =
  | "drafting"
  | "ready_for_review"
  | "awaiting_acceptance"
  | "accepted"
  | "finalized";

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  drafting: "Drafting",
  ready_for_review: "Ready for Review",
  awaiting_acceptance: "Awaiting Acceptance",
  accepted: "Accepted",
  finalized: "Finalized",
};

export interface TermSheet {
  approvedAmount: number;
  interestRate: number;
  repaymentMonths: number;
  minimumPayment: number;
  collateralNotes: string;
  specialConditions: string;
  effectiveDate: string;
  version: number;
}

export interface RequestedTerms {
  amount: number;
  rate: number;
  termMonths: number;
  paymentStructure: string;
}

export interface DealRoom {
  id: string;
  loanProduct: string;
  applicant: string;
  applicantHandle?: string;
  company?: string | null;
  assignedOfficer: string;
  requestedAmount: number;
  proposedAmount: number;
  proposedRate: number;
  status: DealRoomStatus;
  nextAction: string;
  createdAt: string;
  lastActivityAt: string;
  lastActivityLabel: string;
  requested: RequestedTerms;
  termSheet: TermSheet;
  contractStatus: ContractStatus;
  activity: ActivityEvent[];
  messages?: ChatMessage[];
  officerTitle?: string;
  officerInitials?: string;
}

export const DEAL_TIMELINE_STEPS = [
  "Application Submitted",
  "Officer Assigned",
  "Negotiation Started",
  "Term Sheet Issued",
  "Terms Accepted",
  "Contract Generated",
  "Contract Accepted",
  "Disbursement Completed",
] as const;

export type DealTimelineStep = (typeof DEAL_TIMELINE_STEPS)[number];

/**
 * Progress index per status — how far along the 8-step timeline the deal is.
 * Index is the LAST completed step (0-based). -1 means none completed.
 */
export const DEAL_TIMELINE_PROGRESS: Record<DealRoomStatus, number> = {
  under_review: 1,
  negotiating: 2,
  awaiting_applicant: 2,
  awaiting_officer: 2,
  contract_drafting: 5,
  ready_for_signature: 5,
  approved: 6,
  declined: 1,
  closed: 7,
};

export const MOCK_DEAL_ROOMS: DealRoom[] = [
  {
    id: "DR-2046-AURELIA",
    loanProduct: "Business Growth Facility",
    applicant: "Carter Hale",
    applicantHandle: "carter.hale",
    company: "Aurelia Maritime Holdings",
    assignedOfficer: "Alex Morgan",
    requestedAmount: 480_000,
    proposedAmount: 420_000,
    proposedRate: 0.078,
    status: "negotiating",
    nextAction: "Awaiting Applicant Response",
    createdAt: "2026-06-14T09:12:00Z",
    lastActivityAt: "2026-06-24T14:08:00Z",
    lastActivityLabel: "2 hours ago",
    requested: {
      amount: 480_000,
      rate: 0.069,
      termMonths: 60,
      paymentStructure: "Monthly, equal principal",
    },
    termSheet: {
      approvedAmount: 420_000,
      interestRate: 0.078,
      repaymentMonths: 60,
      minimumPayment: 8_540,
      collateralNotes:
        "Senior lien over MV Aurelia I & II vessel registrations. Mortgage filed with Newport Harbour Authority.",
      specialConditions:
        "Quarterly insurance certificate refresh. Loan-to-value covenant ≤ 65%. Annual reviewed financials.",
      effectiveDate: "2026-06-22",
      version: 3,
    },
    contractStatus: "drafting",
    activity: [
      {
        id: "a1",
        kind: "system",
        title: "Application Submitted",
        body: "Business Growth Facility — ƒ480,000 requested over 60 months.",
        timestamp: "2026-06-14T09:12:00Z",
      },
      {
        id: "a2",
        kind: "system",
        title: "Loan Officer Assigned",
        body: "Alex Morgan assigned as relationship officer.",
        timestamp: "2026-06-14T11:42:00Z",
      },
      {
        id: "a3",
        kind: "officer_message",
        title: "Additional Information Requested",
        body:
          "Please share the last two audited financial statements for Aurelia Maritime Holdings and a current insurance certificate for MV Aurelia I.",
        author: "Alex Morgan",
        authorRole: "Senior Credit Officer",
        timestamp: "2026-06-15T13:20:00Z",
      },
      {
        id: "a4",
        kind: "applicant_message",
        title: "Documents Provided",
        body:
          "Uploaded FY24 and FY25 audited statements plus the renewed hull insurance certificate (valid through Mar 2027).",
        author: "Carter Hale",
        authorRole: "Authorized Representative",
        timestamp: "2026-06-17T10:05:00Z",
      },
      {
        id: "a5",
        kind: "system",
        title: "Term Sheet Issued — v1",
        body: "ƒ400,000 @ 8.20% over 60 months.",
        timestamp: "2026-06-19T08:30:00Z",
      },
      {
        id: "a6",
        kind: "applicant_message",
        title: "Counterproposal Submitted",
        body:
          "Requesting ƒ440,000 at 7.50% to fund hull refit timeline. Willing to add quarterly covenant reporting.",
        author: "Carter Hale",
        authorRole: "Authorized Representative",
        timestamp: "2026-06-20T16:50:00Z",
      },
      {
        id: "a7",
        kind: "system",
        title: "Rate Proposal Updated — v2",
        body: "ƒ420,000 @ 7.80% over 60 months. Awaiting applicant review.",
        timestamp: "2026-06-22T09:15:00Z",
      },
      {
        id: "a8",
        kind: "officer_message",
        title: "Term Sheet Issued — v3",
        body:
          "Updated to reflect the agreed LTV covenant. This is our best-and-final structure pending committee sign-off.",
        author: "Alex Morgan",
        authorRole: "Senior Credit Officer",
        timestamp: "2026-06-24T14:08:00Z",
      },
    ],
  },
  {
    id: "DR-2051-HBRLINE",
    loanProduct: "Working Capital Line",
    applicant: "Harbor Line Logistics",
    company: "Harbor Line Logistics",
    assignedOfficer: "Priya Raman",
    requestedAmount: 150_000,
    proposedAmount: 150_000,
    proposedRate: 0.062,
    status: "ready_for_signature",
    nextAction: "Awaiting Counterparty Signature",
    createdAt: "2026-05-28T12:00:00Z",
    lastActivityAt: "2026-06-23T17:30:00Z",
    lastActivityLabel: "Yesterday",
    requested: {
      amount: 150_000,
      rate: 0.06,
      termMonths: 24,
      paymentStructure: "Revolving line, monthly interest",
    },
    termSheet: {
      approvedAmount: 150_000,
      interestRate: 0.062,
      repaymentMonths: 24,
      minimumPayment: 775,
      collateralNotes: "Unsecured. Personal guarantee from operating principal.",
      specialConditions: "Monthly utilization report. Cleanup period of 30 consecutive days annually.",
      effectiveDate: "2026-06-23",
      version: 2,
    },
    contractStatus: "awaiting_acceptance",
    activity: [
      {
        id: "b1",
        kind: "system",
        title: "Application Submitted",
        timestamp: "2026-05-28T12:00:00Z",
      },
      {
        id: "b2",
        kind: "system",
        title: "Terms Accepted",
        body: "Applicant accepted term sheet v2.",
        timestamp: "2026-06-22T09:45:00Z",
      },
      {
        id: "b3",
        kind: "system",
        title: "Contract Draft Generated",
        timestamp: "2026-06-23T17:30:00Z",
      },
    ],
  },
  {
    id: "DR-2059-MERIDIAN",
    loanProduct: "Private Liquidity Line",
    applicant: "Meridian Partners",
    company: "Meridian Partners",
    assignedOfficer: "Alex Morgan",
    requestedAmount: 2_400_000,
    proposedAmount: 2_000_000,
    proposedRate: 0.054,
    status: "under_review",
    nextAction: "Credit Committee Briefing",
    createdAt: "2026-06-21T08:00:00Z",
    lastActivityAt: "2026-06-24T09:00:00Z",
    lastActivityLabel: "5 hours ago",
    requested: {
      amount: 2_400_000,
      rate: 0.05,
      termMonths: 36,
      paymentStructure: "Interest-only, balloon at maturity",
    },
    termSheet: {
      approvedAmount: 2_000_000,
      interestRate: 0.054,
      repaymentMonths: 36,
      minimumPayment: 9_000,
      collateralNotes: "Pledge over Alta Exchange-listed equity portfolio.",
      specialConditions: "Margin maintenance covenant @ 175%. Monthly portfolio valuation.",
      effectiveDate: "2026-06-24",
      version: 1,
    },
    contractStatus: "drafting",
    activity: [
      {
        id: "c1",
        kind: "system",
        title: "Application Submitted",
        timestamp: "2026-06-21T08:00:00Z",
      },
      {
        id: "c2",
        kind: "system",
        title: "Loan Officer Assigned",
        body: "Routed to Private Bank desk — Alex Morgan.",
        timestamp: "2026-06-21T10:15:00Z",
      },
      {
        id: "c3",
        kind: "officer_message",
        title: "Additional Information Requested",
        body: "Please provide the most recent custodial statement and beneficial ownership disclosure.",
        author: "Alex Morgan",
        authorRole: "Senior Credit Officer",
        timestamp: "2026-06-24T09:00:00Z",
      },
    ],
  },
  {
    id: "DR-2061-HELIX",
    loanProduct: "Founder Capital Line",
    applicant: "Helix Dynamics",
    company: "Helix Dynamics",
    assignedOfficer: "Jordan Vale",
    requestedAmount: 75_000,
    proposedAmount: 75_000,
    proposedRate: 0.092,
    status: "approved",
    nextAction: "Disbursement Scheduled",
    createdAt: "2026-05-04T09:00:00Z",
    lastActivityAt: "2026-06-20T11:00:00Z",
    lastActivityLabel: "4 days ago",
    requested: {
      amount: 75_000,
      rate: 0.09,
      termMonths: 18,
      paymentStructure: "Monthly, equal principal",
    },
    termSheet: {
      approvedAmount: 75_000,
      interestRate: 0.092,
      repaymentMonths: 18,
      minimumPayment: 4_512,
      collateralNotes: "Unsecured. Founder personal guarantee.",
      specialConditions: "Quarterly revenue reporting.",
      effectiveDate: "2026-06-18",
      version: 4,
    },
    contractStatus: "finalized",
    activity: [
      {
        id: "d1",
        kind: "system",
        title: "Loan Approved",
        timestamp: "2026-06-20T11:00:00Z",
      },
    ],
  },
];

export function getDealRoom(id: string): DealRoom | undefined {
  return MOCK_DEAL_ROOMS.find((r) => r.id === id);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatDealDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDealDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}