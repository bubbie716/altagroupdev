export type BankAccountStatus = "Active" | "Restricted" | "Pending Review";

export interface BankAccount {
  id: string;
  name: string;
  product: string;
  type: string;
  accountNumber: string;
  routingNumber?: string;
  balance: number;
  status: BankAccountStatus;
  recentActivity: string;
}

export type BankProductCategory = "Retail Banking" | "Business Banking" | "Alta Private";

export interface BankProduct {
  name: string;
  category: BankProductCategory;
  positioning: string;
  bestFor: string;
  benefits: string[];
  availability: string;
  /** Alta Private products — invitation-only visual treatment */
  isPrivate?: boolean;
}

export interface LendingProduct {
  name: string;
  limit: string;
  rate: string;
  repayment: string;
  summary: string;
  status: "Available" | "By invitation" | "Under review" | "Apply" | "Alta Private";
}

export interface TransferRecord {
  id: string;
  date: string;
  type: "Internal" | "Wire" | "Scheduled";
  from: string;
  to: string;
  amount: number;
  status: "Completed" | "Pending" | "Scheduled";
  settlement?: string;
}

export interface AdminClient {
  id: string;
  name: string;
  tier: string;
  relationshipValue: number;
  accountStatus: BankAccountStatus;
  privateInvite: "Extended" | "None" | "Pending";
}

export interface AdminLoanRequest {
  id: string;
  client: string;
  product: string;
  amount: number;
  status: "Pending" | "Approved" | "Denied";
  submitted: string;
}

export interface BankMarketingSection {
  title: string;
  desc: string;
  to: string;
}

export interface BusinessService {
  name: string;
  desc: string;
  metric: string;
}

export interface MetricItem {
  label: string;
  value: string;
}
