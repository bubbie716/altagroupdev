export type BankAccountStatus = "Active" | "Restricted" | "Pending Review";

export interface BankAccount {
  id: string;
  name: string;
  product: string;
  type: string;
  accountNumber: string;
  balance: number;
  status: BankAccountStatus;
  recentActivity: string;
}

export interface BankProduct {
  name: string;
  minimumBalance: string;
  bestFor: string;
  benefits: string[];
  availability: string;
}

export interface LendingProduct {
  name: string;
  limit: string;
  rate: string;
  summary: string;
  status: "Available" | "By invitation" | "Under review";
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
