/**
 * UI LAB ONLY — DO NOT RUN IN PRODUCTION
 *
 * Seeds the database with the Carter Townshend mock user and a rich set
 * of companies, accounts, transactions, transfer contacts, scheduled
 * payments, payroll, statements, and loans so every UI surface has data
 * to render. Safe to re-run: every write is an upsert by stable id.
 *
 *   bun run prisma/seed-ui-lab.ts
 */
import {
  BankAccountStatus,
  BankAccountType,
  BankStatementStatus,
  BankTransactionStatus,
  BankTransactionType,
  CompanyRole,
  CompanyStatus,
  CompanyType,
  IntrabankContactKind,
  LoanApplicationStatus,
  LoanInterestRateType,
  LoanLedgerEntryType,
  LoanPaymentStatus,
  LoanProductType,
  LoanScheduleInstallmentStatus,
  LoanStatus,
  PaymentFrequency,
  PayrollEmployeeStatus,
  PayrollRunStatus,
  PrismaClient,
  ScheduledPaymentStatus,
  ScheduledPaymentType,
  ScheduledTransferScope,
  TransferContactScope,
  UserTag,
  VerificationStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const USER_ID = "ui-lab-user";
const DISCORD_ID = "000000000099999999";

const COMPANIES = [
  {
    id: "CO-ALTG",
    name: "Alta Group N.V.",
    type: CompanyType.INSTITUTION,
    ticker: "ALTG",
    sector: "Financials",
    status: CompanyStatus.LISTED,
    verificationStatus: VerificationStatus.VERIFIED,
  },
  {
    id: "CO-NPC",
    name: "Newport Petroleum Corp.",
    type: CompanyType.LISTED_COMPANY,
    ticker: "NPC",
    sector: "Energy",
    status: CompanyStatus.LISTED,
    verificationStatus: VerificationStatus.VERIFIED,
  },
  {
    id: "CO-HBR",
    name: "Harbor Logistics Ltd.",
    type: CompanyType.PRIVATE_COMPANY,
    ticker: null,
    sector: "Industrials",
    status: CompanyStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
  },
  {
    id: "CO-PRTH",
    name: "Port Haven Maritime",
    type: CompanyType.PRIVATE_COMPANY,
    ticker: "PRTH",
    sector: "Industrials",
    status: CompanyStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
  },
  {
    id: "CO-ALTB",
    name: "Alta Bank Holdings",
    type: CompanyType.BANK,
    ticker: "ALTB",
    sector: "Financials",
    status: CompanyStatus.LISTED,
    verificationStatus: VerificationStatus.VERIFIED,
  },
] as const;

const MEMBERSHIPS: { companyId: string; role: CompanyRole }[] = [
  { companyId: "CO-ALTG", role: CompanyRole.OWNER },
  { companyId: "CO-NPC", role: CompanyRole.OWNER },
  { companyId: "CO-HBR", role: CompanyRole.EXECUTIVE },
  { companyId: "CO-PRTH", role: CompanyRole.FINANCE_MANAGER },
  { companyId: "CO-ALTB", role: CompanyRole.COMPLIANCE_CONTACT },
];

const ACCOUNTS = [
  // Personal
  { id: "BA-LAB-ACCESS", number: "AB-1000-100001", type: BankAccountType.ALTA_ACCESS,        name: "Carter — Alta Access",       balance: "12450.75",   companyId: null },
  { id: "BA-LAB-CHK",    number: "AB-2000-100002", type: BankAccountType.CHECKING,           name: "Carter — Everyday Checking", balance: "38214.20",   companyId: null },
  { id: "BA-LAB-SAV",    number: "AB-3000-100003", type: BankAccountType.SAVINGS,            name: "Carter — High-Yield Savings",balance: "127500.00",  companyId: null },
  { id: "BA-LAB-RSV",    number: "AB-4000-100004", type: BankAccountType.RESERVE,            name: "Carter — Reserve",           balance: "5000.00",    companyId: null },
  { id: "BA-LAB-PRV",    number: "AB-9000-100005", type: BankAccountType.PRIVATE,            name: "Carter — Alta Private",      balance: "1842500.00", companyId: null },
  // Business
  { id: "BA-LAB-NPC-OP", number: "AB-5000-100010", type: BankAccountType.BUSINESS_OPERATING, name: "Newport Petroleum — Operating", balance: "2480300.55", companyId: "CO-NPC" },
  { id: "BA-LAB-NPC-RSV",number: "AB-4000-100011", type: BankAccountType.RESERVE,            name: "Newport Petroleum — Reserve",   balance: "750000.00",  companyId: "CO-NPC" },
  { id: "BA-LAB-ALTG-OP",number: "AB-5000-100020", type: BankAccountType.BUSINESS_OPERATING, name: "Alta Group — Treasury",         balance: "9912450.00", companyId: "CO-ALTG" },
] as const;

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const daysAhead = (n: number) => new Date(now.getTime() + n * 86_400_000);

async function upsertUser() {
  await prisma.user.upsert({
    where: { id: USER_ID },
    create: {
      id: USER_ID,
      discordId: DISCORD_ID,
      discordUsername: "carter",
      email: "carter.townshend@ui-lab.local",
      minecraftUsername: "carter",
      accountStatus: "ACTIVE",
      developerAccessStatus: "APPROVED",
    },
    update: {
      discordUsername: "carter",
      email: "carter.townshend@ui-lab.local",
      minecraftUsername: "carter",
      accountStatus: "ACTIVE",
      developerAccessStatus: "APPROVED",
    },
  });
  for (const tag of [UserTag.ADMIN, UserTag.OPERATOR, UserTag.PRIVATE_CLIENT, UserTag.DEVELOPER, UserTag.ISSUER]) {
    await prisma.userTagAssignment.upsert({
      where: { userId_tag: { userId: USER_ID, tag } },
      create: { userId: USER_ID, tag },
      update: {},
    });
  }
}

async function upsertCompanies() {
  for (const c of COMPANIES) {
    await prisma.company.upsert({
      where: { id: c.id },
      create: c,
      update: { name: c.name, type: c.type, ticker: c.ticker, sector: c.sector, status: c.status, verificationStatus: c.verificationStatus },
    });
  }
  for (const m of MEMBERSHIPS) {
    await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: USER_ID, companyId: m.companyId } },
      create: { userId: USER_ID, companyId: m.companyId, role: m.role },
      update: { role: m.role },
    });
  }
}

async function upsertAccounts() {
  for (const a of ACCOUNTS) {
    await prisma.bankAccount.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        userId: USER_ID,
        companyId: a.companyId,
        accountType: a.type,
        accountName: a.name,
        accountNumber: a.number,
        status: BankAccountStatus.ACTIVE,
        balance: a.balance,
        currency: "FLR",
      },
      update: {
        accountName: a.name,
        balance: a.balance,
        status: BankAccountStatus.ACTIVE,
        companyId: a.companyId,
      },
    });
  }
}

async function upsertTransactions() {
  const txs = [
    { id: "TX-LAB-1", acc: "BA-LAB-CHK",    type: BankTransactionType.DEPOSIT,    status: BankTransactionStatus.APPROVED, amt: "4500.00", desc: "Payroll — Alta Group",       ref: "TXLAB000001", days: 2 },
    { id: "TX-LAB-2", acc: "BA-LAB-CHK",    type: BankTransactionType.WITHDRAWAL, status: BankTransactionStatus.APPROVED, amt: "120.50",  desc: "Coffee & lunches",            ref: "TXLAB000002", days: 3 },
    { id: "TX-LAB-3", acc: "BA-LAB-CHK",    type: BankTransactionType.WITHDRAWAL, status: BankTransactionStatus.PENDING,  amt: "2800.00", desc: "Wire — Port Haven invoice",   ref: "TXLAB000003", days: 0 },
    { id: "TX-LAB-4", acc: "BA-LAB-CHK",    type: BankTransactionType.DEPOSIT,    status: BankTransactionStatus.DENIED,   amt: "950.00",  desc: "Returned check",              ref: "TXLAB000004", days: 5 },
    { id: "TX-LAB-5", acc: "BA-LAB-SAV",    type: BankTransactionType.DEPOSIT,    status: BankTransactionStatus.APPROVED, amt: "25000.00",desc: "Quarterly savings transfer",  ref: "TXLAB000005", days: 14 },
    { id: "TX-LAB-6", acc: "BA-LAB-PRV",    type: BankTransactionType.DEPOSIT,    status: BankTransactionStatus.APPROVED, amt: "500000.00",desc: "Private Client deposit",     ref: "TXLAB000006", days: 30 },
    { id: "TX-LAB-7", acc: "BA-LAB-NPC-OP", type: BankTransactionType.DEPOSIT,    status: BankTransactionStatus.APPROVED, amt: "180000.00",desc: "Oil sales — Q2",             ref: "TXLAB000007", days: 7 },
    { id: "TX-LAB-8", acc: "BA-LAB-NPC-OP", type: BankTransactionType.WITHDRAWAL, status: BankTransactionStatus.APPROVED, amt: "62000.00",desc: "Drilling equipment vendor",   ref: "TXLAB000008", days: 8 },
    { id: "TX-LAB-9", acc: "BA-LAB-NPC-OP", type: BankTransactionType.WITHDRAWAL, status: BankTransactionStatus.PENDING,  amt: "15500.00",desc: "Vendor payment — pending review", ref: "TXLAB000009", days: 0 },
    { id: "TX-LAB-10",acc: "BA-LAB-ALTG-OP",type: BankTransactionType.DEPOSIT,    status: BankTransactionStatus.APPROVED, amt: "1200000.00",desc: "Treasury inflow",            ref: "TXLAB000010", days: 12 },
  ];
  for (const t of txs) {
    await prisma.bankTransaction.upsert({
      where: { id: t.id },
      create: {
        id: t.id, bankAccountId: t.acc, type: t.type, status: t.status,
        amount: t.amt, description: t.desc, referenceCode: t.ref,
        createdAt: daysAgo(t.days),
      },
      update: { status: t.status, description: t.desc, amount: t.amt },
    });
  }
}

async function upsertTransferContacts() {
  const contacts = [
    { id: "TC-LAB-1", scope: TransferContactScope.INTRABANK, label: "Savings → Checking",
      intrabankKind: IntrabankContactKind.OWN_ACCOUNT, bankAccountId: "BA-LAB-CHK", accountNumber: "AB-2000-100002", resolvedName: "Carter — Everyday Checking" },
    { id: "TC-LAB-2", scope: TransferContactScope.INTRABANK, label: "Pay Mia (player)",
      intrabankKind: IntrabankContactKind.PLAYER_ACCOUNT, bankAccountId: null, accountNumber: "AB-2000-200099", resolvedName: "Mia (player)" },
    { id: "TC-LAB-3", scope: TransferContactScope.INTERBANK, label: "External — Harbor Bank",
      recipientInstitution: "Harbor Bank N.A.", recipientName: "Port Haven Maritime", routingNumber: "021000089", wireAccountNumber: "9001-447-220" },
  ];
  for (const c of contacts) {
    await prisma.transferContact.upsert({
      where: { id: c.id },
      create: { id: c.id, userId: USER_ID, ...c } as any,
      update: { label: c.label } as any,
    });
  }
}

async function upsertScheduledPayments() {
  const sps = [
    { id: "SP-LAB-1", acc: "BA-LAB-CHK",    type: ScheduledPaymentType.RECURRING, status: ScheduledPaymentStatus.APPROVED,
      label: "Rent", recipient: "Newport Realty", amt: "2400.00", freq: PaymentFrequency.MONTHLY, next: daysAhead(7), companyId: null },
    { id: "SP-LAB-2", acc: "BA-LAB-CHK",    type: ScheduledPaymentType.SCHEDULED, status: ScheduledPaymentStatus.PENDING_REVIEW,
      label: "Tuition", recipient: "Newport University", amt: "8500.00", freq: null, next: daysAhead(14), companyId: null },
    { id: "SP-LAB-3", acc: "BA-LAB-NPC-OP", type: ScheduledPaymentType.RECURRING, status: ScheduledPaymentStatus.APPROVED,
      label: "Lease — Drilling rig", recipient: "Helix Dynamics", amt: "32500.00", freq: PaymentFrequency.MONTHLY, next: daysAhead(3), companyId: "CO-NPC" },
    { id: "SP-LAB-4", acc: "BA-LAB-ALTG-OP",type: ScheduledPaymentType.ONE_TIME,  status: ScheduledPaymentStatus.EXECUTED,
      label: "Dividend distribution", recipient: "Alta Group Shareholders", amt: "500000.00", freq: null, next: null, companyId: "CO-ALTG" },
    { id: "SP-LAB-5", acc: "BA-LAB-CHK",    type: ScheduledPaymentType.RECURRING, status: ScheduledPaymentStatus.PAUSED,
      label: "Gym membership", recipient: "Newport Athletic Club", amt: "150.00", freq: PaymentFrequency.MONTHLY, next: null, companyId: null },
  ];
  for (const s of sps) {
    await prisma.scheduledPayment.upsert({
      where: { id: s.id },
      create: {
        id: s.id, bankAccountId: s.acc, createdByUserId: USER_ID,
        transferScope: ScheduledTransferScope.INTRABANK, paymentType: s.type, label: s.label,
        recipientName: s.recipient, recipientAccountNumber: "AB-2000-300000",
        amount: s.amt, frequency: s.freq, nextRunDate: s.next, status: s.status,
        companyId: s.companyId,
      },
      update: { status: s.status, amount: s.amt, nextRunDate: s.next },
    });
  }
}

async function upsertPayroll() {
  const employees = [
    { id: "PE-LAB-1", company: "CO-NPC",  name: "Alex Rivera",   title: "Drilling Engineer", acct: "AB-2000-410001", amt: "5800.00", day: "1"  },
    { id: "PE-LAB-2", company: "CO-NPC",  name: "Jordan Kim",    title: "Refinery Lead",     acct: "AB-2000-410002", amt: "6200.00", day: "15" },
    { id: "PE-LAB-3", company: "CO-ALTG", name: "Priya Shah",    title: "Treasury Analyst",  acct: "AB-2000-420001", amt: "7400.00", day: "1"  },
    { id: "PE-LAB-4", company: "CO-ALTG", name: "Sam Devon",     title: "Compliance",        acct: "AB-2000-420002", amt: "6900.00", day: "15" },
  ];
  for (const e of employees) {
    await prisma.payrollEmployee.upsert({
      where: { id: e.id },
      create: { id: e.id, companyId: e.company, displayName: e.name, title: e.title, accountNumber: e.acct,
               payAmount: e.amt, payFrequency: PaymentFrequency.MONTHLY, payDay: e.day,
               nextPayDate: daysAhead(10), status: PayrollEmployeeStatus.ACTIVE },
      update: { displayName: e.name, payAmount: e.amt },
    });
  }
  await prisma.payrollRun.upsert({
    where: { id: "PR-LAB-1" },
    create: {
      id: "PR-LAB-1", companyId: "CO-NPC", bankAccountId: "BA-LAB-NPC-OP", createdByUserId: USER_ID,
      label: "Newport — June payroll", totalAmount: "12000.00",
      status: PayrollRunStatus.EXECUTED, payDate: daysAgo(2),
      lineItems: [
        { employeeId: "PE-LAB-1", displayName: "Alex Rivera", accountNumber: "AB-2000-410001", amount: "5800.00" },
        { employeeId: "PE-LAB-2", displayName: "Jordan Kim",  accountNumber: "AB-2000-410002", amount: "6200.00" },
      ],
    },
    update: {},
  });
  await prisma.payrollRun.upsert({
    where: { id: "PR-LAB-2" },
    create: {
      id: "PR-LAB-2", companyId: "CO-ALTG", bankAccountId: "BA-LAB-ALTG-OP", createdByUserId: USER_ID,
      label: "Alta Group — July payroll (pending)", totalAmount: "14300.00",
      status: PayrollRunStatus.PENDING_REVIEW, payDate: daysAhead(5),
      lineItems: [
        { employeeId: "PE-LAB-3", displayName: "Priya Shah", accountNumber: "AB-2000-420001", amount: "7400.00" },
        { employeeId: "PE-LAB-4", displayName: "Sam Devon",  accountNumber: "AB-2000-420002", amount: "6900.00" },
      ],
    },
    update: {},
  });
}

async function upsertStatements() {
  const stmts = [
    { id: "ST-LAB-1", acc: "BA-LAB-CHK",    num: "STMT-LAB-CHK-2025-05", open: "30000.00", close: "38214.20", dep: "12000.00", wd: "3785.80" },
    { id: "ST-LAB-2", acc: "BA-LAB-SAV",    num: "STMT-LAB-SAV-2025-05", open: "102500.00",close: "127500.00",dep: "25000.00", wd: "0.00" },
    { id: "ST-LAB-3", acc: "BA-LAB-NPC-OP", num: "STMT-LAB-NPC-2025-05", open: "2362300.55",close:"2480300.55",dep:"180000.00",wd:"62000.00" },
  ];
  for (const s of stmts) {
    await prisma.bankStatement.upsert({
      where: { id: s.id },
      create: {
        id: s.id, bankAccountId: s.acc, statementNumber: s.num,
        periodStart: daysAgo(45), periodEnd: daysAgo(15),
        openingBalance: s.open, closingBalance: s.close,
        totalDeposits: s.dep, totalWithdrawals: s.wd,
        totalTransfersIn: "0", totalTransfersOut: "0",
        transactionCount: 6, status: BankStatementStatus.GENERATED, generatedAt: daysAgo(14),
      },
      update: {},
    });
  }
}

async function upsertLoans() {
  // 1) Pending application
  await prisma.loanApplication.upsert({
    where: { id: "LA-LAB-PENDING" },
    create: {
      id: "LA-LAB-PENDING", applicantUserId: USER_ID, productType: LoanProductType.PERSONAL_CREDIT_LINE,
      requestedAmount: "15000.00", termMonths: 12, purpose: "Home improvements",
      repaymentPlan: "Monthly", linkedBankAccountId: "BA-LAB-CHK", status: LoanApplicationStatus.PENDING,
    },
    update: {},
  });

  // 2) Denied application
  await prisma.loanApplication.upsert({
    where: { id: "LA-LAB-DENIED" },
    create: {
      id: "LA-LAB-DENIED", applicantUserId: USER_ID, productType: LoanProductType.PERSONAL_CREDIT_LINE,
      requestedAmount: "75000.00", termMonths: 36, purpose: "Speculative trading",
      repaymentPlan: "Monthly", status: LoanApplicationStatus.DENIED,
      reviewNote: "Outside underwriting policy.", reviewedById: USER_ID, reviewedAt: daysAgo(5),
    },
    update: {},
  });

  // 3) Approved → ACTIVE loan with partial repayment
  await prisma.loanApplication.upsert({
    where: { id: "LA-LAB-ACTIVE" },
    create: {
      id: "LA-LAB-ACTIVE", applicantUserId: USER_ID, productType: LoanProductType.PERSONAL_CREDIT_LINE,
      requestedAmount: "24000.00", termMonths: 12, purpose: "Auto purchase",
      repaymentPlan: "Monthly", linkedBankAccountId: "BA-LAB-CHK",
      status: LoanApplicationStatus.APPROVED, reviewedById: USER_ID, reviewedAt: daysAgo(120),
    },
    update: {},
  });
  await prisma.loan.upsert({
    where: { id: "LN-LAB-ACTIVE" },
    create: {
      id: "LN-LAB-ACTIVE", loanApplicationId: "LA-LAB-ACTIVE", borrowerUserId: USER_ID,
      productType: LoanProductType.PERSONAL_CREDIT_LINE,
      principalAmount: "24000.00", outstandingBalance: "18000.00",
      interestRate: "1.25", interestRateType: LoanInterestRateType.MONTHLY_PERCENT,
      termMonths: 12, status: LoanStatus.ACTIVE,
      linkedBankAccountId: "BA-LAB-CHK", autoPayEnabled: true, autoPaySourceBankAccountId: "BA-LAB-CHK",
      approvedById: USER_ID, approvedAt: daysAgo(120),
    },
    update: { outstandingBalance: "18000.00", status: LoanStatus.ACTIVE },
  });
  // schedule: 12 installments, first 3 paid
  for (let i = 1; i <= 12; i++) {
    const paid = i <= 3;
    await prisma.loanPaymentScheduleItem.upsert({
      where: { loanId_installmentNumber: { loanId: "LN-LAB-ACTIVE", installmentNumber: i } },
      create: {
        id: `LSI-LAB-ACT-${i}`, loanId: "LN-LAB-ACTIVE", installmentNumber: i,
        dueDate: new Date(now.getTime() + (i - 4) * 30 * 86_400_000),
        scheduledAmount: "2000.00",
        status: paid ? LoanScheduleInstallmentStatus.PAID : LoanScheduleInstallmentStatus.PENDING,
        paidAt: paid ? daysAgo((4 - i) * 30) : null,
      },
      update: {},
    });
  }
  // ledger: disbursement + 3 payments
  await prisma.loanLedgerEntry.upsert({
    where: { id: "LL-LAB-ACT-0" },
    create: { id: "LL-LAB-ACT-0", loanId: "LN-LAB-ACTIVE", type: LoanLedgerEntryType.DISBURSEMENT,
              amount: "24000.00", balanceAfter: "24000.00", description: "Loan disbursed", createdById: USER_ID,
              createdAt: daysAgo(120) },
    update: {},
  });
  for (let i = 1; i <= 3; i++) {
    await prisma.loanLedgerEntry.upsert({
      where: { id: `LL-LAB-ACT-${i}` },
      create: { id: `LL-LAB-ACT-${i}`, loanId: "LN-LAB-ACTIVE", type: LoanLedgerEntryType.PAYMENT,
                amount: "2000.00", balanceAfter: String(24000 - i * 2000) + ".00",
                description: `Installment ${i} payment`, createdById: USER_ID,
                createdAt: daysAgo((4 - i) * 30) },
      update: {},
    });
    await prisma.loanPayment.upsert({
      where: { id: `LP-LAB-ACT-${i}` },
      create: { id: `LP-LAB-ACT-${i}`, loanId: "LN-LAB-ACTIVE", amount: "2000.00",
                paymentDate: daysAgo((4 - i) * 30), sourceBankAccountId: "BA-LAB-CHK",
                status: LoanPaymentStatus.COMPLETED },
      update: {},
    });
  }

  // 4) Paid-off loan
  await prisma.loanApplication.upsert({
    where: { id: "LA-LAB-PAID" },
    create: {
      id: "LA-LAB-PAID", applicantUserId: USER_ID, productType: LoanProductType.PERSONAL_CREDIT_LINE,
      requestedAmount: "6000.00", termMonths: 6, purpose: "Bridge",
      repaymentPlan: "Monthly", status: LoanApplicationStatus.APPROVED,
      reviewedById: USER_ID, reviewedAt: daysAgo(300),
    },
    update: {},
  });
  await prisma.loan.upsert({
    where: { id: "LN-LAB-PAID" },
    create: {
      id: "LN-LAB-PAID", loanApplicationId: "LA-LAB-PAID", borrowerUserId: USER_ID,
      productType: LoanProductType.PERSONAL_CREDIT_LINE,
      principalAmount: "6000.00", outstandingBalance: "0.00",
      interestRate: "1.00", interestRateType: LoanInterestRateType.MONTHLY_PERCENT,
      termMonths: 6, status: LoanStatus.PAID_OFF,
      linkedBankAccountId: "BA-LAB-CHK",
      approvedById: USER_ID, approvedAt: daysAgo(300),
    },
    update: { outstandingBalance: "0.00", status: LoanStatus.PAID_OFF },
  });

  // 5) Business credit line — active, NPC
  await prisma.loanApplication.upsert({
    where: { id: "LA-LAB-NPC" },
    create: {
      id: "LA-LAB-NPC", applicantUserId: USER_ID, companyId: "CO-NPC",
      productType: LoanProductType.BUSINESS_CREDIT_LINE,
      requestedAmount: "500000.00", termMonths: 24, purpose: "Rig expansion",
      repaymentPlan: "Monthly", linkedBankAccountId: "BA-LAB-NPC-OP",
      status: LoanApplicationStatus.APPROVED, reviewedById: USER_ID, reviewedAt: daysAgo(60),
    },
    update: {},
  });
  await prisma.loan.upsert({
    where: { id: "LN-LAB-NPC" },
    create: {
      id: "LN-LAB-NPC", loanApplicationId: "LA-LAB-NPC", borrowerUserId: USER_ID, companyId: "CO-NPC",
      productType: LoanProductType.BUSINESS_CREDIT_LINE,
      principalAmount: "500000.00", outstandingBalance: "440000.00",
      interestRate: "0.85", interestRateType: LoanInterestRateType.MONTHLY_PERCENT,
      termMonths: 24, status: LoanStatus.ACTIVE,
      linkedBankAccountId: "BA-LAB-NPC-OP", autoPayEnabled: true, autoPaySourceBankAccountId: "BA-LAB-NPC-OP",
      approvedById: USER_ID, approvedAt: daysAgo(60),
    },
    update: { outstandingBalance: "440000.00", status: LoanStatus.ACTIVE },
  });

  // 6) Private liquidity line — active
  await prisma.loanApplication.upsert({
    where: { id: "LA-LAB-PRV" },
    create: {
      id: "LA-LAB-PRV", applicantUserId: USER_ID, productType: LoanProductType.PRIVATE_LIQUIDITY_LINE,
      requestedAmount: "250000.00", termMonths: 12, purpose: "Liquidity bridge against private portfolio",
      repaymentPlan: "Interest-only", linkedBankAccountId: "BA-LAB-PRV",
      status: LoanApplicationStatus.APPROVED, reviewedById: USER_ID, reviewedAt: daysAgo(30),
    },
    update: {},
  });
  await prisma.loan.upsert({
    where: { id: "LN-LAB-PRV" },
    create: {
      id: "LN-LAB-PRV", loanApplicationId: "LA-LAB-PRV", borrowerUserId: USER_ID,
      productType: LoanProductType.PRIVATE_LIQUIDITY_LINE,
      principalAmount: "250000.00", outstandingBalance: "250000.00",
      interestRate: "0.65", interestRateType: LoanInterestRateType.MONTHLY_PERCENT,
      termMonths: 12, status: LoanStatus.ACTIVE,
      linkedBankAccountId: "BA-LAB-PRV",
      approvedById: USER_ID, approvedAt: daysAgo(30),
    },
    update: { status: LoanStatus.ACTIVE },
  });
}

async function main() {
  console.log("[ui-lab] seeding mock user + data…");
  await upsertUser();
  await upsertCompanies();
  await upsertAccounts();
  await upsertTransactions();
  await upsertTransferContacts();
  await upsertScheduledPayments();
  await upsertPayroll();
  await upsertStatements();
  await upsertLoans();
  console.log("[ui-lab] done. Mock user:", USER_ID);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());