import { randomBytes } from "node:crypto";
import type { AltaUser } from "@/lib/auth/types";
import { canManageBusinessTreasury, canViewAltaPayReceived } from "@/lib/auth/permissions";
import type {
  AltaPayPaymentRow,
  AltaPayReceivedSummary,
  AltaPayVolumeSummary,
  PayableCompany,
  PayableRecipient,
  PayFundingSourceOption,
  SubmitAltaPayInput,
  SubmitAltaPayResult,
  SubmitAltaPayToPersonInput,
} from "@/lib/bank/alta-pay-types";
import type { BankingStaffAuditContext } from "@/lib/staff-audit/staff-audit-types";
import { auditSourceMetadata } from "@/lib/internal/audit-metadata";
import { ALTA_PAY_REFERENCE_PREFIX } from "@/lib/bank/alta-pay-types";
import { buildCustomerAccountStatus } from "@/lib/bank/account-status-copy";
import {
  altaPayFromDescription,
  altaPayToDescription,
  stripAltaPayFromPrefix,
  stripAltaPayToPrefix,
} from "@/lib/bank/customer-transaction-copy";
import { prisma } from "@/server/db";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

async function notifyAltaPaySentBestEffort(
  user: AltaUser,
  amount: number,
  referenceCode: string,
  payeeName: string,
  fundingSourceLabel: string,
): Promise<void> {
  try {
    const { notifyAltaPaySent } = await import("@/server/banking-notification.service");
    await notifyAltaPaySent(user.id, amount, referenceCode, payeeName, fundingSourceLabel);
  } catch (error) {
    console.error("[alta-pay] sent notification failed", error);
  }
}

async function notifyAltaPayCompanyReceivedBestEffort(input: {
  payer: AltaUser;
  company: { id: string; name: string };
  amount: number;
  referenceCode: string;
  destinationAccountName: string;
}): Promise<void> {
  try {
    const { notifyAltaPayReceivedToCompany } = await import("@/server/banking-notification.service");
    const payerName = input.payer.minecraftUsername?.trim() || input.payer.discordUsername;
    await notifyAltaPayReceivedToCompany({
      companyId: input.company.id,
      companyName: input.company.name,
      amount: input.amount,
      referenceCode: input.referenceCode,
      payerName,
      toAccountName: input.destinationAccountName,
    });
  } catch (error) {
    console.error("[alta-pay] company received notification failed", error);
  }
}

async function recordAltaPaySentAudit(input: {
  actorUserId: string;
  referenceCode: string;
  amount: number;
  payeeName: string;
  targetCompanyId?: string;
  targetUserId?: string;
  auditContext?: BankingStaffAuditContext;
  fundingSource?: string;
}): Promise<void> {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: "ALTA_PAY_SENT",
    entityType: "BANK_TRANSACTION",
    entityId: input.referenceCode,
    targetUserId: input.targetUserId,
    targetCompanyId: input.targetCompanyId,
    description: `Alta Pay ${input.referenceCode} to ${input.payeeName}`,
    metadata: auditSourceMetadata(input.auditContext?.source, {
      amount: input.amount,
      referenceCode: input.referenceCode,
      payeeName: input.payeeName,
      fundingSource: input.fundingSource,
    }),
  });
}

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function generatePayReferenceBase(): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${ALTA_PAY_REFERENCE_PREFIX}${date}-${suffix}`;
}

async function getAvailableBalance(accountId: string): Promise<number> {
  const { getAccountAvailableBalance } = await import("@/server/account-balance.service");
  return getAccountAvailableBalance(accountId);
}

function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function mapPayRow(
  tx: {
    id: string;
    referenceCode: string;
    amount: { toString(): string };
    memo: string | null;
    createdAt: Date;
    description: string;
    bankAccount?: { accountName: string };
  },
  direction: "sent" | "received",
  payerLabel: string,
  payeeLabel: string,
  sourceAccountName: string | null,
  fundingSourceLabel: string,
): AltaPayPaymentRow {
  const baseRef = tx.referenceCode.replace(/-(OUT|IN)$/, "");
  return {
    id: tx.id,
    referenceCode: baseRef,
    amount: decimalToNumber(tx.amount),
    memo: tx.memo,
    createdAt: tx.createdAt.toISOString(),
    direction,
    payerLabel,
    payeeLabel,
    sourceAccountName,
    fundingSourceLabel,
  };
}

export async function searchPayableCompanies(query: string): Promise<PayableCompany[]> {
  const q = query.trim();

  const companies = await prisma.company.findMany({
    where: {
      verificationStatus: "VERIFIED",
      bankAccounts: {
        some: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
      },
      ...(q.length >= 1
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sector: { contains: q, mode: "insensitive" } },
              { ticker: { contains: q.toUpperCase(), mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      bankAccounts: {
        where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
    take: 20,
  });

  return companies.map((company) => {
    const account = company.bankAccounts[0]!;
    return {
      id: company.id,
      name: company.name,
      sector: company.sector,
      ticker: company.ticker,
      verificationStatus: "verified" as const,
      destinationAccountName: account.accountName,
      destinationLabel: `${company.name} · Business Operating Account`,
    };
  });
}

export async function searchPayableRecipients(
  payerUserId: string,
  query: string,
): Promise<PayableRecipient[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const [companies, users] = await Promise.all([
    searchPayableCompanies(q),
    prisma.user.findMany({
      where: {
        id: { not: payerUserId },
        accountStatus: "ACTIVE",
        OR: [
          { discordUsername: { contains: q, mode: "insensitive" } },
          { minecraftUsername: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        discordUsername: true,
        minecraftUsername: true,
        bankSettings: {
          select: {
            defaultAltaPayReceiveAccount: {
              select: { accountName: true, accountNumber: true, status: true },
            },
          },
        },
        bankAccounts: {
          where: { companyId: null, status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { accountName: true, accountNumber: true, status: true },
        },
      },
      orderBy: { discordUsername: "asc" },
      take: 10,
    }),
  ]);

  const personRecipients: PayableRecipient[] = users.map((user) => {
    const configured = user.bankSettings?.defaultAltaPayReceiveAccount;
    const oldest = user.bankAccounts[0];
    const receiveAccount =
      configured?.status === "ACTIVE" ? configured : oldest?.status === "ACTIVE" ? oldest : null;
    const canReceive = !!receiveAccount;
    const displayName = user.minecraftUsername?.trim() || user.discordUsername;
    return {
      kind: "person",
      id: user.id,
      name: displayName,
      subtitle: user.discordUsername,
      destinationLabel: canReceive
        ? `${receiveAccount.accountName} · ${receiveAccount.accountNumber}`
        : "No active personal Alta Bank account",
      canReceive,
    };
  });

  const companyRecipients: PayableRecipient[] = companies.map((company) => ({
    kind: "company",
    id: company.id,
    name: company.name,
    subtitle: [company.sector, company.ticker].filter(Boolean).join(" · ") || null,
    destinationLabel: company.destinationLabel,
    canReceive: true as const,
  }));

  return [...personRecipients, ...companyRecipients].slice(0, 20);
}

export async function submitAltaPayToPerson(
  user: AltaUser,
  input: SubmitAltaPayToPersonInput,
  auditContext?: BankingStaffAuditContext,
): Promise<SubmitAltaPayResult> {
  if (input.amount <= 0) badRequest("Amount must be greater than zero.");
  if (input.fundingSource.kind !== "bank_account") {
    badRequest("Payments to Alta customers require a bank account funding source.");
  }

  const allowedFunding = await listPayFundingSources(user);
  const funding = allowedFunding.find(
    (source) => source.kind === "bank_account" && source.id === input.fundingSource.accountId,
  );
  if (!funding || funding.kind !== "bank_account") {
    badRequest("Select a valid funding source.");
  }

  if (input.recipientUserId === user.id) {
    badRequest("You cannot send Alta Pay to yourself.");
  }

  const recipient = await prisma.user.findUnique({
    where: { id: input.recipientUserId },
    select: {
      id: true,
      discordUsername: true,
      minecraftUsername: true,
    },
  });
  if (!recipient) badRequest("Recipient not found.");

  const { resolveAltaPayReceiveAccount } = await import("@/server/bank-settings.service");
  const receiveAccount = await resolveAltaPayReceiveAccount(input.recipientUserId);
  if (!receiveAccount) {
    badRequest("This customer does not have an active Alta Bank account to receive Alta Pay.");
  }

  const { submitInternalTransfer } = await import("@/server/bank.service");
  const result = await submitInternalTransfer(
    user.id,
    {
      fromAccountId: input.fundingSource.accountId,
      toAccountNumber: receiveAccount.accountNumber,
      amount: input.amount,
      memo: input.memo,
    },
    auditContext,
    { skipAuditLog: true, suppressRecipientNotification: true },
  );

  const recipientLabel = recipient.minecraftUsername?.trim() || recipient.discordUsername;
  const payerLabel = user.minecraftUsername?.trim() || user.discordUsername;

  await recordAltaPaySentAudit({
    actorUserId: user.id,
    referenceCode: result.referenceCode,
    amount: input.amount,
    payeeName: recipientLabel,
    targetUserId: input.recipientUserId,
    auditContext,
    fundingSource: funding.label,
  });

  await notifyAltaPaySentBestEffort(
    user,
    input.amount,
    result.referenceCode,
    recipientLabel,
    funding.label,
  );

  try {
    const { notifyAltaPayReceived } = await import("@/server/banking-notification.service");
    await notifyAltaPayReceived(
      input.recipientUserId,
      input.amount,
      result.referenceCode,
      payerLabel,
      receiveAccount.accountName,
    );
  } catch (error) {
    console.error("[alta-pay] received notification failed", error);
  }

  return {
    referenceCode: result.referenceCode,
    amount: input.amount,
    companyName: recipientLabel,
    fundingSourceLabel: funding.label,
  };
}

export async function listPayFundingSources(user: AltaUser): Promise<PayFundingSourceOption[]> {
  const [bankAccounts, cardSources] = await Promise.all([
    listPaySourceAccounts(user),
    (async () => {
      const { listAltaCardFundingSources } = await import("@/server/alta-card-transaction.service");
      return listAltaCardFundingSources(user);
    })(),
  ]);

  const options: PayFundingSourceOption[] = bankAccounts.map((account) => ({
    kind: "bank_account",
    id: account.id,
    label: account.isCompanyAccount && account.companyName
      ? `${account.companyName} · ${account.accountName}`
      : account.accountName,
    detail: account.accountNumber,
    availableBalance: account.availableBalance ?? account.balance,
    accountStatusInfo: account.accountStatusInfo,
  }));

  for (const card of cardSources) {
    options.push({
      kind: "alta_card",
      id: card.id,
      label: card.label,
      detail: "Revolving credit",
      availableBalance: card.availableBalance,
      cardLastFour: card.cardLastFour,
      employerCompanyId: card.employerCompanyId,
    });
  }

  return options;
}

/** @deprecated Use listPayFundingSources */
export async function listPaySourceAccounts(user: AltaUser) {
  const manageCompanyIds = user.companyMemberships
    .filter((m) => canManageBusinessTreasury(user, { companyId: m.companyId }))
    .map((m) => m.companyId);

  const accounts = await prisma.bankAccount.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { userId: user.id, companyId: null },
        ...(manageCompanyIds.length > 0
          ? [
              {
                companyId: { in: manageCompanyIds },
                accountType: "BUSINESS_OPERATING" as const,
              },
            ]
          : []),
      ],
    },
    include: {
      company: true,
      transactions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ companyId: "asc" }, { createdAt: "asc" }],
  });

  const { mapUserBankAccount } = await import("@/server/bank-mapper");
  if (accounts.length === 0) return [];

  const accountIds = accounts.map((a) => a.id);
  const {
    getActiveHoldsByAccountIds,
    getPendingWithdrawalsByAccountIds,
    computeAvailableBalance,
  } = await import("@/server/account-balance.service");

  const [holdsByAccount, pendingByAccount] = await Promise.all([
    getActiveHoldsByAccountIds(accountIds),
    getPendingWithdrawalsByAccountIds(accountIds),
  ]);

  return accounts.map((account) => {
    const mapped = mapUserBankAccount(account);
    const holds = holdsByAccount.get(account.id) ?? 0;
    const pending = pendingByAccount.get(account.id) ?? 0;
    const availableBalance = computeAvailableBalance(mapped.balance, pending, holds);
    const accountStatusInfo = buildCustomerAccountStatus({
      status: mapped.status,
      restrictDeposits: mapped.restrictDeposits,
      restrictWithdrawals: mapped.restrictWithdrawals,
      restrictTransfers: mapped.restrictTransfers,
      heldFunds: holds,
      pendingWithdrawals: pending,
    });
    return {
      ...mapped,
      availableBalance,
      accountStatusInfo,
    };
  });
}

/** @deprecated Use listPaySourceAccounts */
export async function listPersonalPaySourceAccounts(userId: string) {
  const { mapDbUserToAltaUser, userWithMembershipsInclude } = await import("@/server/user-mapper");
  const record = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!record) notFound();
  return listPaySourceAccounts(mapDbUserToAltaUser(record));
}

async function resolvePaySourceAccount(user: AltaUser, fromAccountId: string) {
  const account = await prisma.bankAccount.findFirst({
    where: { id: fromAccountId },
    include: { user: true, company: true },
  });
  if (!account) badRequest("Select a valid Alta Bank account.");
  if (account.status !== "ACTIVE") {
    badRequest("This payment couldn't be completed because the source account is not active.");
  }
  if (account.restrictWithdrawals) {
    badRequest("Withdrawals are currently unavailable for this account.");
  }

  if (account.companyId === null) {
    if (account.userId !== user.id) forbidden();
    return { account, payerLabel: account.user.discordUsername };
  }

  if (account.accountType !== "BUSINESS_OPERATING") {
    badRequest("Alta Pay may only be funded from personal accounts or Business Operating Accounts.");
  }
  if (!canManageBusinessTreasury(user, { companyId: account.companyId })) {
    forbidden();
  }

  return { account, payerLabel: account.company?.name ?? account.accountName };
}

async function listPaySourceAccountIds(user: AltaUser): Promise<string[]> {
  const accounts = await listPaySourceAccounts(user);
  return accounts.map((a) => a.id);
}

/**
 * Submit Alta Pay — instant intrabank settlement to a verified company's operating account.
 *
 * TODO: business payment links — shareable URLs that prefill payee + amount
 * TODO: QR codes — scan-to-pay at in-game storefronts
 * TODO: invoices — structured payment requests with line items
 * TODO: refunds — operator or merchant-initiated reversal flow
 * TODO: customer receipts — email/PDF receipt after payment
 * TODO: Discord payment notifications — webhook on PAY settlement
 */
export async function submitAltaPayPayment(
  user: AltaUser,
  input: SubmitAltaPayInput,
  auditContext?: BankingStaffAuditContext,
): Promise<SubmitAltaPayResult> {
  if (input.amount <= 0) badRequest("Amount must be greater than zero.");

  const allowedFunding = await listPayFundingSources(user);
  if (input.fundingSource.kind === "bank_account") {
    const allowed = allowedFunding.some(
      (source) => source.kind === "bank_account" && source.id === input.fundingSource.accountId,
    );
    if (!allowed) badRequest("Select a valid funding source.");
  } else {
    const allowed = allowedFunding.some(
      (source) => source.kind === "alta_card" && source.id === input.fundingSource.cardId,
    );
    if (!allowed) badRequest("Select a valid Alta Card funding source.");
  }

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    include: {
      bankAccounts: {
        where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        take: 1,
      },
    },
  });
  if (!company || company.verificationStatus !== "VERIFIED") {
    badRequest("Company is not available for Alta Pay.");
  }
  const destination = company.bankAccounts[0];
  if (!destination) {
    badRequest("This company does not have an active Business Operating Account.");
  }
  if (destination.restrictDeposits) {
    badRequest("This payment couldn't be completed because deposits are currently restricted on the recipient account.");
  }

  const referenceBase = generatePayReferenceBase();
  const inReference = `${referenceBase}-IN`;
  const memo = input.memo?.trim() || null;

  if (input.fundingSource.kind === "bank_account") {
    const { account: sourceAccount, payerLabel } = await resolvePaySourceAccount(
      user,
      input.fundingSource.accountId,
    );

    if (destination.id === sourceAccount.id) {
      badRequest("Cannot pay your own account through Alta Pay.");
    }
    if (sourceAccount.companyId && sourceAccount.companyId === company.id) {
      badRequest("Cannot pay your own company through Alta Pay from its operating account.");
    }

    const available = await getAvailableBalance(sourceAccount.id);
    if (input.amount > available) {
      badRequest("This payment couldn't be completed because your available balance is insufficient.");
    }

    const outReference = `${referenceBase}-OUT`;

    await prisma.$transaction(async (tx) => {
      await tx.bankAccount.update({
        where: { id: sourceAccount.id },
        data: { balance: { decrement: input.amount } },
      });
      await tx.bankAccount.update({
        where: { id: destination.id },
        data: { balance: { increment: input.amount } },
      });

      await tx.bankTransaction.create({
        data: {
          bankAccountId: sourceAccount.id,
          type: "WITHDRAWAL",
          amount: input.amount,
          status: "APPROVED",
          description: altaPayToDescription(company.name),
          memo,
          referenceCode: outReference,
          proofImageUrl: null,
        },
      });

      await tx.bankTransaction.create({
        data: {
          bankAccountId: destination.id,
          type: "DEPOSIT",
          amount: input.amount,
          status: "APPROVED",
          description: altaPayFromDescription(payerLabel),
          memo,
          referenceCode: inReference,
          proofImageUrl: null,
        },
      });
    });

    const { refreshUserRelationshipProfileBestEffort, refreshCompanyRelationshipStackBestEffort } =
      await import("@/server/relationship-refresh-hooks.service");
    await refreshUserRelationshipProfileBestEffort(user.id, "alta-pay-completed");
    await refreshCompanyRelationshipStackBestEffort(company.id, "alta-pay-completed");

    await recordAltaPaySentAudit({
      actorUserId: user.id,
      referenceCode: referenceBase,
      amount: input.amount,
      payeeName: company.name,
      targetCompanyId: company.id,
      auditContext,
      fundingSource: sourceAccount.accountName,
    });

    await notifyAltaPaySentBestEffort(
      user,
      input.amount,
      referenceBase,
      company.name,
      sourceAccount.accountName,
    );

    await notifyAltaPayCompanyReceivedBestEffort({
      payer: user,
      company,
      amount: input.amount,
      referenceCode: referenceBase,
      destinationAccountName: destination.accountName,
    });

    return {
      referenceCode: referenceBase,
      amount: input.amount,
      companyName: company.name,
      fundingSourceLabel: sourceAccount.accountName,
    };
  }

  const { chargeAltaCardForAltaPay } = await import("@/server/alta-card-transaction.service");
  const payerLabel = user.discordUsername;

  let cardTxId = "";
  let fundingSourceLabel = "Alta Card";

  await prisma.$transaction(async (tx) => {
    const cardTx = await chargeAltaCardForAltaPay(tx, {
      user,
      fundingId: input.fundingSource.cardId,
      amount: input.amount,
      companyId: company.id,
      companyName: company.name,
      altaPayReference: referenceBase,
      memo,
    });
    cardTxId = cardTx.id;
    fundingSourceLabel =
      (cardTx.metadata?.fundingSource as string | undefined) ??
      `Alta Card •••• ${cardTx.referenceCode}`;

    await tx.bankAccount.update({
      where: { id: destination.id },
      data: { balance: { increment: input.amount } },
    });

    await tx.bankTransaction.create({
      data: {
        bankAccountId: destination.id,
        type: "DEPOSIT",
        amount: input.amount,
        status: "APPROVED",
        description: altaPayFromDescription(payerLabel),
        memo,
        referenceCode: inReference,
        proofImageUrl: null,
      },
    });
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: user.id,
    action: "ALTA_PAY_SENT",
    entityType: "ALTA_CARD",
    entityId: input.fundingSource.cardId.replace(/^employee:/, ""),
    description: `Alta Pay charge of ${input.amount} to ${company.name}`,
    targetCompanyId: company.id,
    metadata: auditSourceMetadata(auditContext?.source, {
      cardId: input.fundingSource.cardId,
      cardTransactionId: cardTxId,
      amount: input.amount,
      fundingSource: fundingSourceLabel,
      referenceCode: referenceBase,
    }),
  });

  const { refreshUserRelationshipProfileBestEffort, refreshCompanyRelationshipStackBestEffort } =
    await import("@/server/relationship-refresh-hooks.service");
  await refreshUserRelationshipProfileBestEffort(user.id, "alta-pay-completed");
  await refreshCompanyRelationshipStackBestEffort(company.id, "alta-pay-completed");

  await notifyAltaPaySentBestEffort(
    user,
    input.amount,
    referenceBase,
    company.name,
    fundingSourceLabel,
  );

  await notifyAltaPayCompanyReceivedBestEffort({
    payer: user,
    company,
    amount: input.amount,
    referenceCode: referenceBase,
    destinationAccountName: destination.accountName,
  });

  return {
    referenceCode: referenceBase,
    amount: input.amount,
    companyName: company.name,
    fundingSourceLabel: fundingSourceLabel,
    cardTransactionId: cardTxId,
  };
}

export async function listUserAltaPaySent(user: AltaUser, limit = 25): Promise<AltaPayPaymentRow[]> {
  const sourceAccountIds = await listPaySourceAccountIds(user);

  const bankTxs =
    sourceAccountIds.length === 0
      ? []
      : await prisma.bankTransaction.findMany({
          where: {
            bankAccountId: { in: sourceAccountIds },
            type: "WITHDRAWAL",
            status: "APPROVED",
            referenceCode: { startsWith: ALTA_PAY_REFERENCE_PREFIX, endsWith: "-OUT" },
          },
          include: { bankAccount: { include: { company: true } } },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

  const cardTxs = await prisma.altaCardTransaction.findMany({
    where: {
      type: "ALTA_PAY",
      status: "COMPLETED",
      createdByUserId: user.id,
    },
    include: {
      merchantCompany: { select: { name: true } },
      altaEmployeeCard: { include: { company: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const bankRows = bankTxs.map((tx) => {
    const payee = stripAltaPayToPrefix(tx.description);
    const payer =
      tx.bankAccount.companyId && tx.bankAccount.company
        ? tx.bankAccount.company.name
        : "You";
    return mapPayRow(tx, "sent", payer, payee, tx.bankAccount.accountName, tx.bankAccount.accountName);
  });

  const cardRows: AltaPayPaymentRow[] = cardTxs.map((tx) => {
    const funding =
      tx.metadata &&
      typeof tx.metadata === "object" &&
      !Array.isArray(tx.metadata) &&
      typeof (tx.metadata as Record<string, unknown>).fundingSource === "string"
        ? ((tx.metadata as Record<string, unknown>).fundingSource as string)
        : "Alta Card";
    const ref = tx.relatedAltaPayPaymentId ?? tx.referenceCode.replace(/-CARD$/, "");
    return {
      id: tx.id,
      referenceCode: ref,
      amount: decimalToNumber(tx.amount),
      memo:
        tx.metadata &&
        typeof tx.metadata === "object" &&
        !Array.isArray(tx.metadata) &&
        typeof (tx.metadata as Record<string, unknown>).memo === "string"
          ? ((tx.metadata as Record<string, unknown>).memo as string)
          : null,
      createdAt: tx.createdAt.toISOString(),
      direction: "sent",
      payerLabel: "You",
      payeeLabel: tx.merchantCompany?.name ?? tx.description,
      sourceAccountName: null,
      fundingSourceLabel: funding,
    };
  });

  return [...bankRows, ...cardRows]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function listCompanyAltaPayReceived(
  user: AltaUser,
  companyId: string,
): Promise<AltaPayReceivedSummary> {
  if (!canViewAltaPayReceived(user, { companyId })) forbidden();

  const operating = await prisma.bankAccount.findFirst({
    where: { companyId, accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
  });
  if (!operating) {
    return { totalThisMonth: 0, paymentCountThisMonth: 0, recentPayments: [] };
  }

  const monthStart = startOfUtcMonth();
  const received = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId: operating.id,
      type: "DEPOSIT",
      status: "APPROVED",
      referenceCode: { startsWith: ALTA_PAY_REFERENCE_PREFIX, endsWith: "-IN" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const monthReceived = received.filter((tx) => tx.createdAt >= monthStart);
  const totalThisMonth = monthReceived.reduce((sum, tx) => sum + decimalToNumber(tx.amount), 0);

  const company = await prisma.company.findUnique({ where: { id: companyId } });

  const recentPayments = received.slice(0, 20).map((tx) => {
    const payer = stripAltaPayFromPrefix(tx.description);
    return mapPayRow(
      tx,
      "received",
      payer,
      company?.name ?? "Company",
      null,
      payer,
    );
  });

  return {
    totalThisMonth,
    paymentCountThisMonth: monthReceived.length,
    recentPayments,
  };
}

export async function getAltaPayVolumeSummary(): Promise<AltaPayVolumeSummary> {
  const monthStart = startOfUtcMonth();
  const txs = await prisma.bankTransaction.findMany({
    where: {
      type: "DEPOSIT",
      status: "APPROVED",
      referenceCode: { startsWith: ALTA_PAY_REFERENCE_PREFIX, endsWith: "-IN" },
      createdAt: { gte: monthStart },
    },
    select: { amount: true },
  });

  return {
    countThisMonth: txs.length,
    volumeThisMonth: txs.reduce((sum, tx) => sum + decimalToNumber(tx.amount), 0),
  };
}
