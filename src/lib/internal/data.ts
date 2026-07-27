import type {
  AdminActivityItem,
  BankDepositWithdrawRequest,
  BankLoanApplication,
  BankOpsAccount,
  BankOpsSummary,
  BankOpsTransfer,
  CompanyAccount,
  ComplianceCase,
  InternalOverviewMetrics,
  InternalSettings,
  InternalUser,
  SystemStatusItem,
  TerminalActivitySummary,
  TerminalOrderRow,
} from "./types";

export const internalPreviewNotice =
  "Internal preview data — not connected to live operations.";

export const overviewMetrics: InternalOverviewMetrics = {
  /** @deprecated Use fetchPlatformMetrics() for live internal overview stats. */
  totalUsers: 0,
  activeBankAccounts: 0,
  openComplianceFlags: 0,
  settlementVolume: "—",
  registeredCompanies: 0,
  verifiedInstitutions: 0,
  authorizedRepresentatives: 0,
  pendingCompanyReviews: 0,
};

export const systemStatus: SystemStatusItem[] = [
  { service: "Alta Bank Core", status: "Operational", detail: "Live bank accounts and treasury records" },
  {
    service: "Alta Terminal",
    status: "Degraded",
    detail: "Brokerage under development — trading and market data not live pending exchange connectivity",
  },
  {
    service: "Company Registry",
    status: "Operational",
    detail: "Company registration and verification",
  },
];

export const recentAdminActivity: AdminActivityItem[] = [
  { id: "ACT-8842", timestamp: "2026-06-22 21:22", actor: "terminal.ops", action: "Reviewed Terminal funding request", target: "TFUND-44102", division: "Terminal" },
  { id: "ACT-8841", timestamp: "2026-06-22 21:14", actor: "carter.ops", action: "Reviewed company verification", target: "Helix Dynamics (HLXD)", division: "Compliance" },
  { id: "ACT-8840", timestamp: "2026-06-22 20:52", actor: "rm.jensen", action: "Reviewed relationship profile", target: "harborline", division: "Bank" },
  { id: "ACT-8839", timestamp: "2026-06-22 20:31", actor: "compliance.lee", action: "Escalated transfer flag", target: "TXN-44102", division: "Compliance" },
  { id: "ACT-8838", timestamp: "2026-06-22 19:48", actor: "ops.martinez", action: "Reviewed transfer flag", target: "TXN-44102", division: "Compliance" },
  { id: "ACT-8837", timestamp: "2026-06-22 19:02", actor: "ops.martinez", action: "Froze account", target: "user: vaultseeker", division: "Bank" },
  { id: "ACT-8836", timestamp: "2026-06-22 18:44", actor: "terminal.ops", action: "Reviewed order cluster", target: "ORD batch #218", division: "Terminal" },
];

export const internalUsers: InternalUser[] = [
  {
    id: "USR-001",
    username: "vaultseeker",
    discordId: "284719384712345678",
    minecraftUsername: "VaultSeeker",
    tags: ["corporate_admin"],
    accountStatus: "Active",
    lastActive: "2026-06-22 21:08",
    companyMemberships: [
      { companyId: "CO-NPC", companyName: "Newport Petroleum Corp.", role: "finance_manager", representativeStatus: "Authorized" },
    ],
  },
  {
    id: "USR-002",
    username: "harborline",
    discordId: "193847562839102938",
    minecraftUsername: "HarborLine",
    tags: [],
    accountStatus: "Active",
    lastActive: "2026-06-22 20:55",
    companyMemberships: [
      { companyId: "CO-PRTH", companyName: "Port Haven Maritime", role: "executive", representativeStatus: "Authorized" },
      { companyId: "CO-HBR", companyName: "Harbor Logistics Ltd.", role: "owner", representativeStatus: "Authorized" },
    ],
  },
  {
    id: "USR-003",
    username: "npc_trader",
    discordId: "948372615038472819",
    minecraftUsername: "NPCTrader",
    tags: [],
    accountStatus: "Active",
    lastActive: "2026-06-22 20:41",
    companyMemberships: [],
  },
  {
    id: "USR-004",
    username: "meridian_founder",
    discordId: "562938471029384756",
    minecraftUsername: "MeridianCEO",
    tags: ["corporate_admin"],
    accountStatus: "Active",
    lastActive: "2026-06-22 19:22",
    companyMemberships: [
      { companyId: "CO-MRDN", companyName: "Meridian Logistics", role: "owner", representativeStatus: "Authorized" },
    ],
  },
  {
    id: "USR-005",
    username: "compliance_watch",
    discordId: "738291048572910384",
    minecraftUsername: "AuditTrail",
    tags: [],
    accountStatus: "Active",
    lastActive: "2026-06-22 18:09",
    companyMemberships: [
      { companyId: "CO-ALTB", companyName: "Alta Bank Holdings", role: "compliance_contact", representativeStatus: "Authorized" },
    ],
  },
  {
    id: "USR-006",
    username: "frozen_case",
    discordId: "829104857291038475",
    minecraftUsername: "FrozenCase",
    tags: [],
    accountStatus: "Frozen",
    lastActive: "2026-06-18 14:33",
    companyMemberships: [
      { companyId: "CO-AURM", companyName: "Aurum Mining Trust", role: "viewer", representativeStatus: "Revoked" },
    ],
  },
  {
    id: "USR-007",
    username: "helix_founder",
    discordId: "910384756291038475",
    minecraftUsername: "HelixFounder",
    tags: [],
    accountStatus: "Pending",
    lastActive: "2026-06-22 17:44",
    companyMemberships: [
      { companyId: "CO-HLXD", companyName: "Helix Dynamics Ltd.", role: "owner", representativeStatus: "Pending" },
    ],
  },
  {
    id: "USR-008",
    username: "terminal_power",
    discordId: "102938475629103847",
    minecraftUsername: "TermPower",
    tags: [],
    accountStatus: "Active",
    lastActive: "2026-06-22 21:02",
    companyMemberships: [
      { companyId: "CO-NPC", companyName: "Newport Petroleum Corp.", role: "viewer", representativeStatus: "Authorized" },
    ],
  },
];

export const companyAccounts: CompanyAccount[] = [
  {
    id: "CO-NPC",
    name: "Newport Petroleum Corp.",
    ticker: "NPC",
    type: "Listed Company",
    sector: "Energy",
    status: "Listed",
    verificationStatus: "Verified",
    primaryContact: "vaultseeker",
    representativeCount: 2,
    representatives: [
      { userId: "USR-001", username: "vaultseeker", role: "finance_manager", status: "Authorized", since: "2025-11-02" },
      { userId: "USR-008", username: "terminal_power", role: "viewer", status: "Authorized", since: "2026-03-14" },
    ],
    lastUpdated: "2026-06-22",
    documents: [
      { id: "DOC-1", name: "Certificate of incorporation", status: "Complete", received: "2025-10-18" },
      { id: "DOC-2", name: "Beneficial ownership register", status: "Complete", received: "2025-10-20" },
    ],
    bankAccounts: [{ id: "ALT-OPS-NPC01", product: "Corporate Treasury", status: "Active" }],
  },
  {
    id: "CO-HLXD",
    name: "Helix Dynamics Ltd.",
    ticker: "HLXD",
    type: "Private Company",
    sector: "Technology",
    status: "Pending",
    verificationStatus: "Pending Review",
    primaryContact: "HelixFounder",
    representativeCount: 1,
    representatives: [
      { userId: "USR-007", username: "helix_founder", role: "owner", status: "Pending", since: "2026-06-18" },
    ],
    lastUpdated: "2026-06-22",
    documents: [
      { id: "DOC-3", name: "Prospectus draft", status: "Partial", received: "2026-06-20" },
      { id: "DOC-4", name: "Board resolution", status: "Missing", received: null },
    ],
    bankAccounts: [],
  },
  {
    id: "CO-MRDN",
    name: "Meridian Logistics",
    ticker: "MRDN",
    type: "Listed Company",
    sector: "Industrials",
    status: "Listed",
    verificationStatus: "Verified",
    primaryContact: "MeridianCEO",
    representativeCount: 1,
    representatives: [
      { userId: "USR-004", username: "meridian_founder", role: "owner", status: "Authorized", since: "2024-08-01" },
    ],
    lastUpdated: "2026-06-21",
    documents: [{ id: "DOC-5", name: "Annual report", status: "Complete", received: "2026-06-08" }],
    bankAccounts: [{ id: "ALT-OPS-MRDN1", product: "Corporate Operating", status: "Active" }],
  },
  {
    id: "CO-HBR",
    name: "Harbor Logistics Ltd.",
    ticker: null,
    type: "Private Company",
    sector: "Industrials",
    status: "Active",
    verificationStatus: "Verified",
    primaryContact: "harborline",
    representativeCount: 1,
    representatives: [
      { userId: "USR-002", username: "harborline", role: "owner", status: "Authorized", since: "2026-01-10" },
    ],
    lastUpdated: "2026-06-19",
    documents: [{ id: "DOC-6", name: "KYC pack", status: "Complete", received: "2026-01-08" }],
    bankAccounts: [{ id: "ALT-CHK-HBR01", product: "Business Checking", status: "Active" }],
  },
  {
    id: "CO-ALTB",
    name: "Alta Bank Holdings",
    ticker: "ALTB",
    type: "Bank",
    sector: "Financials",
    status: "Listed",
    verificationStatus: "Verified",
    primaryContact: "compliance_watch",
    representativeCount: 1,
    representatives: [
      { userId: "USR-005", username: "compliance_watch", role: "compliance_contact", status: "Authorized", since: "2025-06-01" },
    ],
    lastUpdated: "2026-06-20",
    documents: [{ id: "DOC-7", name: "Regulatory registration", status: "Complete", received: "2025-05-12" }],
    bankAccounts: [{ id: "ALT-INST-ALTB", product: "Institutional Reserve", status: "Active" }],
  },
  {
    id: "CO-CRFE",
    name: "Coral Reef Energy",
    ticker: "CRFE",
    type: "Private Company",
    sector: "Energy",
    status: "Pending",
    verificationStatus: "Unverified",
    primaryContact: "ReefOps",
    representativeCount: 0,
    representatives: [],
    lastUpdated: "2026-06-22",
    documents: [{ id: "DOC-9", name: "Incorporation documents", status: "Missing", received: null }],
    bankAccounts: [],
  },
];

/** @deprecated Use fetchInternalBankOps() — live DB-backed bank operations summary. */
export const bankOpsSummary: BankOpsSummary = {
  totalAccounts: 0,
  pendingDeposits: 0,
  pendingWithdrawals: 0,
  transfersInReview: 0,
  lendingQueue: 0,
  frozenAccounts: 0,
};

export const bankOpsAccounts: BankOpsAccount[] = [
  { id: "ALT-CHK-88421", holder: "vaultseeker", product: "Alta Checking", balance: "ƒ284,220", status: "Active" },
  { id: "ALT-PRV-00291", holder: "harborline", product: "Alta Money Market", balance: "ƒ4.2M", status: "Active" },
  { id: "ALT-OPS-44102", holder: "frozen_case", product: "Reserve Account", balance: "ƒ88,410", status: "Frozen" },
  { id: "ALT-CHK-77219", holder: "meridian_founder", product: "Alta Checking", balance: "ƒ1.1M", status: "Active" },
];

export const bankOpsLoanApplications: BankLoanApplication[] = [
  {
    id: "LN-4401",
    applicant: "meridian_founder",
    company: "Meridian Logistics",
    product: "Business Credit",
    amount: "ƒ2,500,000",
    purpose: "Fleet expansion — 12 new haul units",
    status: "Under Review",
    submitted: "2026-06-21",
  },
  {
    id: "LN-4398",
    applicant: "harborline",
    company: "Harbor Logistics Ltd.",
    product: "Secured Lending",
    amount: "ƒ1,200,000",
    purpose: "Warehouse leasehold improvements",
    status: "Under Review",
    submitted: "2026-06-20",
  },
  {
    id: "LN-4392",
    applicant: "vaultseeker",
    company: "Newport Petroleum Corp.",
    product: "Corporate Term Loan",
    amount: "ƒ8,000,000",
    purpose: "Refinery maintenance capex",
    status: "Approved",
    submitted: "2026-06-15",
  },
  {
    id: "LN-4388",
    applicant: "helix_founder",
    company: "Helix Dynamics Ltd.",
    product: "Startup Credit Line",
    amount: "ƒ500,000",
    purpose: "Operating runway",
    status: "New",
    submitted: "2026-06-22",
  },
  {
    id: "LN-4381",
    applicant: "anon_dev",
    company: null,
    product: "Personal Line",
    amount: "ƒ75,000",
    purpose: "Unspecified — insufficient documentation",
    status: "Needs Info",
    submitted: "2026-06-19",
  },
  {
    id: "LN-4375",
    applicant: "ReefOps",
    company: "Coral Reef Energy",
    product: "Project Finance",
    amount: "ƒ3,400,000",
    purpose: "Offshore platform retrofit",
    status: "Rejected",
    submitted: "2026-06-12",
  },
];

export const bankOpsTransfers: BankOpsTransfer[] = [
  {
    id: "TXN-44102",
    type: "Wire",
    from: "ALT-CHK-88421",
    to: "EXT-HARBOR-99201",
    amount: "ƒ125,000",
    settlement: "External wire",
    submitted: "2026-06-22 20:28",
    status: "Review",
  },
  {
    id: "TXN-44098",
    type: "Interbank",
    from: "ALT-OPS-22019",
    to: "ALT-CHK-77219",
    amount: "ƒ42,500",
    settlement: "Alta Bank",
    submitted: "2026-06-22 19:14",
    status: "Review",
  },
  {
    id: "TXN-44095",
    type: "Wire",
    from: "ALT-PRV-00291",
    to: "Harbor Capital Partners",
    amount: "ƒ1,200,000",
    settlement: "External wire",
    submitted: "2026-06-22 18:44",
    status: "Review",
  },
  {
    id: "TXN-44091",
    type: "Internal",
    from: "ALT-PRV-00291",
    to: "ALT-RES-11802",
    amount: "ƒ890,000",
    settlement: "Alta Bank",
    submitted: "2026-06-22 18:02",
    status: "Cleared",
  },
  {
    id: "TXN-44088",
    type: "Interbank",
    from: "ALT-INST-ALTB",
    to: "EXT-FED-001",
    amount: "ƒ4,500,000",
    settlement: "External wire",
    submitted: "2026-06-22 17:30",
    status: "Review",
  },
  {
    id: "TXN-44082",
    type: "Wire",
    from: "ALT-CHK-77219",
    to: "Meridian Holdings LLP",
    amount: "ƒ240,000",
    settlement: "External wire",
    submitted: "2026-06-22 16:12",
    status: "Cleared",
  },
];

export const bankOpsDepositWithdrawRequests: BankDepositWithdrawRequest[] = [
  {
    id: "DW-8821",
    type: "Deposit",
    account: "ALT-CHK-88421",
    holder: "vaultseeker",
    amount: "ƒ50,000",
    method: "Wire in",
    status: "Pending",
    submitted: "2026-06-22 21:02",
  },
  {
    id: "DW-8818",
    type: "Withdrawal",
    account: "ALT-CHK-77219",
    holder: "meridian_founder",
    amount: "ƒ18,500",
    method: "ATM / branch",
    status: "Review",
    submitted: "2026-06-22 20:48",
  },
  {
    id: "DW-8814",
    type: "Deposit",
    account: "ALT-PRV-00291",
    holder: "harborline",
    amount: "ƒ2,000,000",
    method: "Negotiated CD rollover",
    status: "Review",
    submitted: "2026-06-22 19:30",
  },
  {
    id: "DW-8810",
    type: "Withdrawal",
    account: "ALT-OPS-44102",
    holder: "frozen_case",
    amount: "ƒ12,000",
    method: "Online transfer out",
    status: "Rejected",
    submitted: "2026-06-22 18:55",
  },
  {
    id: "DW-8806",
    type: "Deposit",
    account: "ALT-CHK-HBR01",
    holder: "harborline",
    amount: "ƒ320,000",
    method: "Business ACH in",
    status: "Posted",
    submitted: "2026-06-22 17:20",
  },
  {
    id: "DW-8802",
    type: "Withdrawal",
    account: "ALT-CHK-88421",
    holder: "vaultseeker",
    amount: "ƒ8,200",
    method: "Cashier's check",
    status: "Pending",
    submitted: "2026-06-22 16:40",
  },
  {
    id: "DW-8798",
    type: "Deposit",
    account: "ALT-OPS-NPC01",
    holder: "vaultseeker",
    amount: "ƒ1,500,000",
    method: "Treasury wire in",
    status: "Posted",
    submitted: "2026-06-22 15:10",
  },
];

export const terminalActivitySummary: TerminalActivitySummary = {
  activeUsers24h: 412,
  openOrders: 38,
  researchViews24h: 1284,
  watchlistAdds24h: 96,
};

export const terminalOpenOrders: TerminalOrderRow[] = [
  { id: "ORD-8821", user: "vaultseeker", symbol: "NPC", side: "BUY", qty: 200, status: "Working", time: "21:04" },
  { id: "ORD-8820", user: "terminal_power", symbol: "ALTB", side: "SELL", qty: 150, status: "Working", time: "20:58" },
  { id: "ORD-8819", user: "npc_trader", symbol: "MRDN", side: "BUY", qty: 500, status: "Working", time: "20:41" },
  { id: "ORD-8818", user: "harborline", symbol: "VRDA", side: "BUY", qty: 80, status: "Partial", time: "20:22" },
];

export const terminalTopViewed = [
  { symbol: "NPC", views: 842 },
  { symbol: "ALTB", views: 614 },
  { symbol: "MRDN", views: 488 },
  { symbol: "AURM", views: 392 },
  { symbol: "HWY", views: 318 },
];

export const terminalWatchlistTrends = [
  { symbol: "HLXD", adds: 48, label: "Watchlist add" },
  { symbol: "PRTH", adds: 31, label: "Momentum" },
  { symbol: "VRDA", adds: 27, label: "Sector rotation" },
];

export const complianceCases: ComplianceCase[] = [
  { id: "CMP-441", title: "Large outbound wire — review threshold", category: "Suspicious transfer", severity: "High", status: "Assigned", assignee: "compliance.lee", opened: "2026-06-22" },
  { id: "CMP-440", title: "Coordinated buy cluster — MRDN", category: "Market conduct", severity: "Medium", status: "Open", assignee: "—", opened: "2026-06-22" },
  { id: "CMP-439", title: "Account freeze appeal", category: "Account freeze", severity: "Low", status: "Open", assignee: "ops.martinez", opened: "2026-06-21" },
];

export const internalSettings: InternalSettings = {
  maintenanceMode: false,
  marketStatus: "Closed",
  bankTransfers: "Review Required",
  featureFlags: [
    { key: "terminal_trade_preview", label: "Terminal order entry (preview)", enabled: true },
    { key: "compliance_auto_escalate", label: "Auto-escalate critical flags", enabled: false },
  ],
};
