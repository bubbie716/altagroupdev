import { florin } from "@/lib/format/money-display";
import { makeSeries, transactions } from "@/lib/mock-data";
import { getRoutingNumber } from "@/lib/bank/routing";
import type {
  AdminClient,
  AdminLoanRequest,
  BankAccount,
  BankMarketingSection,
  BankProduct,
  BusinessService,
  LendingProduct,
  MetricItem,
  TransferRecord,
} from "./types";

export { florin };

export const bankDescription =
  "Personal banking, business accounts, deposits, lending, and treasury services for Newport citizens, builders, and institutions.";

export const bankDashboard = {
  totalRelationshipValue: 12_127_276.21,
  checkingBalance: 184_220.15,
  savingsBalance: 1_240_500.0,
  moneyMarketBalance: 4_812_440.22,
  businessBalance: 2_390_115.84,
  creditAvailable: 3_500_000.0,
  balanceTrend: makeSeries(90, 11_800_000, 120_000, 4_200),
};

const mockRoutingNumber = getRoutingNumber();

export const bankAccounts: BankAccount[] = [
  {
    id: "mock-checking-1187",
    name: "Alta Checking",
    product: "Checking",
    type: "Personal",
    accountNumber: "AB-2000-482913",
    routingNumber: mockRoutingNumber,
    balance: 184_220.15,
    status: "Active",
    recentActivity: "Wire — Meridian Holdings · Jun 22",
  },
  {
    id: "mock-savings-7740",
    name: "Alta Savings",
    product: "Savings",
    type: "Personal",
    accountNumber: "AB-3000-938144",
    routingNumber: mockRoutingNumber,
    balance: 890_500.0,
    status: "Active",
    recentActivity: "Interest credit · Jun 21",
  },
  {
    id: "mock-mm-3312",
    name: "Alta Money Market",
    product: "Money Market",
    type: "Personal",
    accountNumber: "AB-6000-774120",
    routingNumber: mockRoutingNumber,
    balance: 2_890_000.0,
    status: "Active",
    recentActivity: "Transfer from Checking · Jun 20",
  },
  {
    id: "mock-business-4402",
    name: "Alta Business Operating",
    product: "Operating",
    type: "Business",
    accountNumber: "AB-5000-661204",
    routingNumber: mockRoutingNumber,
    balance: 2_390_115.84,
    status: "Active",
    recentActivity: "Payroll disbursement · Jun 19",
  },
  {
    id: "mock-mm-0021",
    name: "Alta Money Market Premier",
    product: "Money Market",
    type: "Personal",
    accountNumber: "AB-6000-118742",
    routingNumber: mockRoutingNumber,
    balance: 4_812_440.22,
    status: "Active",
    recentActivity: "Money market deposit · Jun 18",
  },
];

export const bankProducts: BankProduct[] = [
  {
    name: "Alta Access",
    category: "Retail Banking",
    positioning: "Starter banking for new Newport citizens.",
    bestFor: "New citizens and first-time account holders.",
    benefits: [
      "Basic checking access",
      "Starter transfers",
      "Upgrade path to Alta Checking",
    ],
    availability: "Open",
  },
  {
    name: "Alta Checking",
    category: "Retail Banking",
    positioning: "Everyday banking for active Newport citizens.",
    bestFor: "Daily spending, transfers, and account activity.",
    benefits: [
      "Everyday transaction account",
      "Standard deposits and withdrawals",
      "Transfer-ready account structure",
      "Upgrade path to premium products",
    ],
    availability: "Open",
  },
  {
    name: "Alta Savings",
    category: "Retail Banking",
    positioning: "A simple savings account for building Florin reserves.",
    bestFor: "Citizens building cash reserves.",
    benefits: [
      "Savings-focused account",
      "Monthly yield placeholder",
      "Reserve-building product",
      "Easy movement to checking",
    ],
    availability: "Open",
  },
  {
    name: "Alta Money Market",
    category: "Retail Banking",
    positioning: "Higher-balance savings for serious depositors.",
    bestFor: "Larger balances and yield-focused depositors.",
    benefits: [
      "Premium savings product",
      "Higher-balance account structure",
      "Yield-focused positioning",
      "Priority deposit review",
    ],
    availability: "Open",
  },
  {
    name: "Business Operating Account",
    category: "Business Banking",
    positioning: "Operating account for companies, shops, and institutions.",
    bestFor: "Company treasury, payroll, merchant activity, and business deposits.",
    benefits: [
      "Company account structure",
      "Business deposits and withdrawals",
      "Authorized representative access",
      "Payroll and merchant tools",
    ],
    availability: "Requires verified company",
  },
  {
    name: "Personal Alta Card",
    category: "Credit & Cards",
    positioning: "Revolving credit line inside Alta Bank for personal clients.",
    bestFor: "Alta Pay funding, cash advances, and statement billing.",
    benefits: [
      "Relationship-based limits and rates",
      "Revolving credit inside Alta Bank",
      "Autopay and card controls in Alta Bank",
      "Upgrade path through Alta Gold",
    ],
    availability: "Apply",
    applyHref: "/bank/alta-card",
    applySearch: { apply: "1" },
    ctaLabel: "Apply",
  },
  {
    name: "Business Alta Card",
    category: "Credit & Cards",
    positioning: "Company revolving credit for verified Newport businesses.",
    bestFor: "Company treasury, merchant spend, and authorized representatives.",
    benefits: [
      "Company card structure with representative access",
      "Business Alta Pay and merchant activity",
      "Statement billing tied to company accounts",
      "Manual underwriting for verified companies",
    ],
    availability: "Apply",
    applyHref: "/bank/alta-card/business",
    applySearch: { apply: "1" },
    ctaLabel: "Apply",
  },
  {
    name: "Personal Credit Line",
    category: "Lending",
    positioning: "Revolving credit for established Alta Bank personal clients.",
    bestFor: "Personal liquidity with manual underwriting review.",
    benefits: [
      "Up to ƒ1.5M indicative limit",
      "Term lending with scheduled repayment",
      "Underwriting tied to Alta relationship",
      "Apply from Alta Bank lending",
    ],
    availability: "Apply",
    applyHref: "/bank/lending",
    applySearch: { apply: "1", product: "personal_credit_line" },
    ctaLabel: "Apply",
  },
  {
    name: "Business Credit Line",
    category: "Lending",
    positioning: "Operating credit lines for verified Newport companies.",
    bestFor: "Company cash flow and institutional operating credit.",
    benefits: [
      "Up to ƒ10M indicative limit",
      "Business-focused underwriting",
      "Typical terms up to 8 months",
      "Apply from Alta Bank lending",
    ],
    availability: "Apply",
    applyHref: "/bank/lending",
    applySearch: { apply: "1", product: "business_credit_line" },
    ctaLabel: "Apply",
  },
];

/** @deprecated Use bankProducts */
export const depositProducts = bankProducts;

export const lendingProducts: LendingProduct[] = [
  {
    name: "Personal Credit Line",
    limit: "Up to ƒ1.5M",
    rate: "7.5% monthly",
    repayment: "Typical term: up to 6 months",
    summary: "Revolving credit for established Alta Bank personal clients. Manual underwriting required.",
    status: "Apply",
  },
  {
    name: "Business Credit Line",
    limit: "Up to ƒ10M",
    rate: "6% monthly",
    repayment: "Typical term: up to 8 months",
    summary: "Operating credit lines for verified Newport companies with institutional cash flow.",
    status: "Apply",
  },
];

export const transferHistory: TransferRecord[] = [
  {
    id: "TRF-8821",
    date: "2026-06-22",
    type: "Wire",
    from: "Alta Checking ••1187",
    to: "Meridian Holdings LLP",
    amount: -240_000,
    status: "Completed",
    settlement: "External wire",
  },
  {
    id: "TRF-8814",
    date: "2026-06-21",
    type: "Internal",
    from: "Alta Checking ••1187",
    to: "Alta Money Market · AB-6000-774120",
    amount: -150_000,
    status: "Completed",
    settlement: "Alta Bank",
  },
  {
    id: "TRF-8808",
    date: "2026-06-25",
    type: "Scheduled",
    from: "Alta Business ••4402",
    to: "Payroll — Staff Accounts",
    amount: -428_500,
    status: "Scheduled",
    settlement: "External wire",
  },
  {
    id: "TRF-8795",
    date: "2026-06-18",
    type: "Wire",
    from: "Alta Money Market ••0021",
    to: "Harbor Capital Partners",
    amount: -1_200_000,
    status: "Completed",
    settlement: "External wire",
  },
];

export const businessMetrics: MetricItem[] = [
  { label: "Operating Accounts", value: "Live per company" },
  { label: "Payroll Services", value: "Coming Soon" },
  { label: "Merchant Accounts", value: "Preview" },
  { label: "Business Lending", value: "Coming Soon" },
  { label: "Treasury Services", value: "In Development" },
];

export const businessServices: BusinessService[] = [
  {
    name: "Operating Accounts",
    desc: "Multi-entity cash management for verified Newport companies.",
    metric: "Live · Business Operating Account",
  },
  {
    name: "Merchant Accounts",
    desc: "Institutional settlement and receivables for Newport merchants.",
    metric: "Preview · not yet active",
  },
  {
    name: "Payroll Services",
    desc: "Employee registry, payroll batches, and disbursement workflows.",
    metric: "Coming Soon",
  },
  {
    name: "Business Lending",
    desc: "Revolving and term credit for operating companies and institutions.",
    metric: "Coming Soon",
  },
  {
    name: "Treasury Services",
    desc: "Sweep, FX, and short-term instruments for corporate treasury desks.",
    metric: "In Development",
  },
];

export const adminClients: AdminClient[] = [
  { id: "CL-10021", name: "Whitford Family Office", tier: "Personal Premier", relationshipValue: 12_127_276, accountStatus: "Active" },
  { id: "CL-10044", name: "Meridian Holdings LLP", tier: "Business Premier", relationshipValue: 4_820_000, accountStatus: "Active" },
  { id: "CL-10089", name: "Harbor Capital Partners", tier: "Institutional", relationshipValue: 28_400_000, accountStatus: "Active" },
  { id: "CL-10102", name: "Carter Whitford", tier: "Personal", relationshipValue: 890_000, accountStatus: "Under Review" },
];

export const adminLoanQueue: AdminLoanRequest[] = [
  { id: "LN-4401", client: "Meridian Holdings LLP", product: "Business Credit", amount: 2_500_000, status: "Pending", submitted: "2026-06-21" },
  { id: "LN-4398", client: "Whitford Family Office", product: "Personal Credit Line", amount: 5_000_000, status: "Pending", submitted: "2026-06-19" },
  { id: "LN-4392", client: "Port Haven Maritime", product: "Secured Lending", amount: 1_200_000, status: "Approved", submitted: "2026-06-15" },
];

export const bankRecentActivity = transactions.slice(0, 6).map((tx, index) => {
  const account = bankAccounts[index % bankAccounts.length];
  return {
    ...tx,
    accountId: account.id,
    accountName: account.name,
    accountNumber: account.accountNumber,
  };
});

export const bankMarketingSections: BankMarketingSection[] = [
  { title: "Alta Access", desc: "Starter banking for new Newport citizens.", to: "/bank/products" },
  { title: "Alta Checking", desc: "Everyday banking for active Newport citizens.", to: "/bank/products" },
  { title: "Business Banking", desc: "Operating accounts, payroll, and treasury for Newport institutions.", to: "/bank/business" },
  { title: "Bank Products", desc: "Retail and business deposit products for Newport.", to: "/bank/products" },
  { title: "Lending", desc: "Personal, business, and secured credit for Newport's leading clients.", to: "/bank/lending" },
  { title: "Transfers & Wires", desc: "Internal transfers and external wire settlement.", to: "/bank/transfers" },
  { title: "Bank Like the 1%", desc: "Balances, credit access, and activity across your Alta Bank relationship.", to: "/bank" },
  { title: "Alta Card", desc: "Revolving credit from Alta White through Alta Gold.", to: "/bank/alta-card" },
];
