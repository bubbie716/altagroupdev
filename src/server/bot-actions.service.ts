import type { SubmitAltaPayInput } from "@/lib/bank/alta-pay-types";
import type { UserBankAccount } from "@/lib/bank/backend-types";
import {
  depositBlockedReason,
  transferBlockedReason,
  withdrawalBlockedReason,
} from "@/lib/bank/account-status-copy";
import { uploadBankProof, type ProofFileInput } from "@/lib/storage/proof-upload";
import {
  listPayFundingSources,
  searchPayableRecipients,
  submitAltaPayPayment,
  submitAltaPayToPerson,
} from "@/server/alta-pay.service";
import { loadAltaUserOrThrow } from "@/server/bank-account-access.service";
import {
  assertBotDepositLimit,
  assertBotTransferAllowed,
  assertBotWithdrawalLimit,
  formatBotAltaPayLimitsDisclosure,
  quoteBotAltaPay,
  quoteBotTransfer,
  recordBotTransferUsage,
  type BotAltaPayQuote,
  type BotTransferQuote,
} from "@/server/bot-banking-limits.service";
import { getUserBankSettings } from "@/server/bank-settings.service";
import {
  listUserBankAccounts,
  submitDepositRequest,
  submitInternalTransfer,
  submitWithdrawalRequest,
} from "@/server/bank.service";
import { prisma } from "@/server/db";

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

export type BotActionAccount = {
  id: string;
  accountName: string;
  accountNumber: string;
  availableBalance: number;
  isCompanyAccount: boolean;
  companyName: string | null;
};

export type BotPayableRecipient = {
  kind: "company" | "person";
  id: string;
  name: string;
  subtitle: string | null;
  destinationLabel: string;
  canReceive: boolean;
};

export type BotPayContext = {
  fundingSources: Awaited<ReturnType<typeof listPayFundingSources>>;
  defaultFundingKey: string | null;
  limitsDisclosure: string;
  recentRecipients: BotRecentPayRecipient[];
};

export type BotRecentPayRecipient = {
  kind: "company" | "person";
  id: string;
  name: string;
};

export type BotAltaPayRecipientInput =
  | { kind: "company"; companyId: string }
  | { kind: "person"; recipientUserId: string };

export type BotAltaPaySubmitInput = {
  fundingSource: SubmitAltaPayInput["fundingSource"];
  recipient: BotAltaPayRecipientInput;
  amount: number;
  memo?: string;
};

function mapActionAccount(account: UserBankAccount): BotActionAccount {
  return {
    id: account.id,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    availableBalance: account.availableBalance,
    isCompanyAccount: account.isCompanyAccount,
    companyName: account.companyName,
  };
}

export async function listBotDepositAccounts(userId: string): Promise<BotActionAccount[]> {
  const accounts = await listUserBankAccounts(userId);
  return accounts
    .filter((account) => account.status === "active" && !depositBlockedReason(account.accountStatusInfo))
    .map(mapActionAccount);
}

export async function listBotWithdrawAccounts(userId: string): Promise<BotActionAccount[]> {
  const accounts = await listUserBankAccounts(userId);
  return accounts
    .filter(
      (account) => account.status === "active" && !withdrawalBlockedReason(account.accountStatusInfo),
    )
    .map(mapActionAccount);
}

export async function listBotTransferAccounts(userId: string): Promise<BotActionAccount[]> {
  const accounts = await listUserBankAccounts(userId);
  return accounts
    .filter(
      (account) =>
        account.status === "active" && !transferBlockedReason(account.accountStatusInfo, "source"),
    )
    .map(mapActionAccount);
}

export async function listBotTransferDestinationAccounts(
  userId: string,
  fromAccountId: string,
): Promise<BotActionAccount[]> {
  const accounts = await listUserBankAccounts(userId);
  return accounts
    .filter(
      (account) =>
        account.id !== fromAccountId &&
        account.status === "active" &&
        !transferBlockedReason(account.accountStatusInfo, "destination"),
    )
    .map(mapActionAccount);
}

export async function listBotRecentPayRecipients(
  userId: string,
  limit = 5,
): Promise<BotRecentPayRecipient[]> {
  const payments = await prisma.payment.findMany({
    where: {
      payerUserId: userId,
      paymentType: "ALTA_PAY",
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
    take: limit * 3,
    select: {
      recipientUserId: true,
      metadata: true,
    },
  });

  const recipients: BotRecentPayRecipient[] = [];
  const seen = new Set<string>();

  for (const payment of payments) {
    if (payment.recipientUserId) {
      const key = `person:${payment.recipientUserId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const user = await prisma.user.findUnique({
        where: { id: payment.recipientUserId },
        select: { discordUsername: true },
      });
      if (!user?.discordUsername) continue;
      recipients.push({
        kind: "person",
        id: payment.recipientUserId,
        name: user.discordUsername,
      });
    } else if (payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)) {
      const meta = payment.metadata as Record<string, unknown>;
      const companyId = typeof meta.companyId === "string" ? meta.companyId : null;
      const payeeName = typeof meta.payeeName === "string" ? meta.payeeName : "Company";
      if (companyId) {
        const key = `company:${companyId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push({ kind: "company", id: companyId, name: payeeName });
      }
    }

    if (recipients.length >= limit) break;
  }

  return recipients;
}

function encodePayFundingKey(kind: "bank_account" | "alta_card", id: string): string {
  return kind === "bank_account" ? `b:${id}` : `c:${id}`;
}

export async function getBotPayContext(userId: string): Promise<BotPayContext> {
  const user = await loadAltaUserOrThrow(userId);
  const [fundingSources, settings, recentRecipients] = await Promise.all([
    listPayFundingSources(user),
    getUserBankSettings(user),
    listBotRecentPayRecipients(userId),
  ]);

  let defaultFundingKey: string | null = null;
  if (settings.defaultAltaPayFundingAccountId) {
    const match = fundingSources.find(
      (source) =>
        source.kind === "bank_account" && source.id === settings.defaultAltaPayFundingAccountId,
    );
    if (match) {
      defaultFundingKey = encodePayFundingKey(match.kind, match.id);
    }
  }

  return {
    fundingSources,
    defaultFundingKey,
    limitsDisclosure: formatBotAltaPayLimitsDisclosure(),
    recentRecipients,
  };
}

export async function resolveBotPayRecipientLabel(
  recipient: BotAltaPayRecipientInput,
): Promise<{ name: string; kind: "company" | "person" }> {
  if (recipient.kind === "company") {
    const company = await prisma.company.findUnique({
      where: { id: recipient.companyId },
      select: { name: true },
    });
    return { kind: "company", name: company?.name ?? "Verified company" };
  }
  const user = await prisma.user.findUnique({
    where: { id: recipient.recipientUserId },
    select: { discordUsername: true },
  });
  return { kind: "person", name: user?.discordUsername ?? "Alta customer" };
}

export async function quoteBotAltaPayForUser(
  userId: string,
  fundingSource:
    | { kind: "bank_account"; accountId: string }
    | { kind: "alta_card"; cardId: string },
  amount: number,
): Promise<BotAltaPayQuote> {
  const payContext = await getBotPayContext(userId);
  const fundingKey =
    fundingSource.kind === "bank_account"
      ? encodePayFundingKey("bank_account", fundingSource.accountId)
      : encodePayFundingKey("alta_card", fundingSource.cardId);
  const source = payContext.fundingSources.find(
    (item) => encodePayFundingKey(item.kind, item.id) === fundingKey,
  );
  if (!source) {
    return {
      allowed: false,
      reason: "That funding source is no longer available.",
      payAmount: amount,
      totalDebited: amount,
      requiresWebsite: false,
    };
  }
  return quoteBotAltaPay(amount, source.availableBalance);
}

export async function searchBotPayRecipients(
  userId: string,
  query: string,
): Promise<BotPayableRecipient[]> {
  const recipients = await searchPayableRecipients(userId, query);
  return recipients.map((recipient) => ({
    kind: recipient.kind,
    id: recipient.id,
    name: recipient.name,
    subtitle: recipient.subtitle,
    destinationLabel: recipient.destinationLabel,
    canReceive: recipient.canReceive,
  }));
}

/** @deprecated Use searchBotPayRecipients */
export async function searchBotPayCompanies(query: string) {
  const { searchPayableCompanies } = await import("@/server/alta-pay.service");
  return searchPayableCompanies(query);
}

export async function quoteBotTransferForUser(
  userId: string,
  amount: number,
): Promise<BotTransferQuote> {
  return quoteBotTransfer(userId, amount);
}

export type { BotAltaPayQuote };

async function collectDiscordTransferFee(
  userId: string,
  accountId: string,
  fee: number,
  transferReference: string,
): Promise<void> {
  if (fee <= 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.bankAccount.update({
      where: { id: accountId },
      data: { balance: { decrement: fee } },
    });
    await tx.bankTransaction.create({
      data: {
        bankAccountId: accountId,
        type: "WITHDRAWAL",
        amount: fee,
        status: "APPROVED",
        description: "Discord banking convenience fee",
        memo: `Transfer ${transferReference}`,
        referenceCode: `${transferReference}-FEE`,
      },
    });
  });

  try {
    const { recordBotDiscordTransferFeeBestEffort } = await import("@/server/bot-audit.service");
    await recordBotDiscordTransferFeeBestEffort({
      userId,
      accountId,
      fee,
      transferReference,
    });
  } catch (error) {
    console.error("[bot-actions] transfer fee audit failed", error);
  }
}

const BOT_STAFF_AUDIT: { source: "discord_bot" } = { source: "discord_bot" };

export async function submitBotDeposit(
  userId: string,
  input: { bankAccountId: string; amount: number; memo?: string },
  file: { name: string; type: string; size: number; buffer: Buffer },
): Promise<{ transactionId: string; referenceCode: string }> {
  assertBotDepositLimit(input.amount);

  try {
    const proofFile: ProofFileInput = {
      name: file.name,
      type: file.type,
      size: file.size,
      arrayBuffer: async () =>
        file.buffer.buffer.slice(
          file.buffer.byteOffset,
          file.buffer.byteOffset + file.buffer.byteLength,
        ) as ArrayBuffer,
    };

    const proof = await uploadBankProof(proofFile, { userId, transactionType: "deposit" });

    return await submitDepositRequest(
      userId,
      {
        bankAccountId: input.bankAccountId,
        amount: input.amount,
        memo: input.memo,
      },
      {
        proofImageUrl: proof.url,
        proofFileName: proof.fileName,
        proofMimeType: proof.mimeType,
        proofSizeBytes: proof.sizeBytes,
        proofUploadedAt: proof.uploadedAt,
      },
      BOT_STAFF_AUDIT,
    );
  } catch (error) {
    const { recordBotBankingActionFailedBestEffort, friendlyBotFailureReason } = await import(
      "@/server/bot-audit.service"
    );
    await recordBotBankingActionFailedBestEffort({
      userId,
      action: "deposit",
      amount: input.amount,
      accountId: input.bankAccountId,
      reason: friendlyBotFailureReason(error),
    });
    throw error;
  }
}

export async function submitBotWithdrawal(
  userId: string,
  input: { bankAccountId: string; amount: number; memo?: string },
): Promise<{ transactionId: string; referenceCode: string }> {
  assertBotWithdrawalLimit(input.amount);

  try {
    return await submitWithdrawalRequest(userId, input, BOT_STAFF_AUDIT);
  } catch (error) {
    const { recordBotBankingActionFailedBestEffort, friendlyBotFailureReason } = await import(
      "@/server/bot-audit.service"
    );
    await recordBotBankingActionFailedBestEffort({
      userId,
      action: "withdrawal",
      amount: input.amount,
      accountId: input.bankAccountId,
      reason: friendlyBotFailureReason(error),
    });
    throw error;
  }
}

export async function submitBotTransfer(
  userId: string,
  input: { fromAccountId: string; toAccountId: string; amount: number; memo?: string },
): Promise<{ referenceCode: string }> {
  const quote = await assertBotTransferAllowed(userId, input.amount);

  const accounts = await listUserBankAccounts(userId);
  const fromAccount = accounts.find((account) => account.id === input.fromAccountId);
  if (!fromAccount) badRequest("That source account is not available.");

  if (fromAccount.availableBalance < quote.totalDebited) {
    badRequest("This transfer couldn't be completed because your available balance is insufficient.");
  }

  try {
    const result = await submitInternalTransfer(
      userId,
      {
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amount: input.amount,
        memo: input.memo,
      },
      BOT_STAFF_AUDIT,
    );

    await collectDiscordTransferFee(userId, input.fromAccountId, quote.convenienceFee, result.referenceCode);
    await recordBotTransferUsage(userId, input.amount);

    return result;
  } catch (error) {
    const { notifyTransferFailedBestEffort, friendlyFailureReason } = await import(
      "@/server/banking-notification.service"
    );
    const { recordBotBankingActionFailedBestEffort, friendlyBotFailureReason } = await import(
      "@/server/bot-audit.service"
    );
    const reason = friendlyBotFailureReason(error);
    void notifyTransferFailedBestEffort(userId, {
      amount: input.amount,
      reason: friendlyFailureReason(error),
    });
    await recordBotBankingActionFailedBestEffort({
      userId,
      action: "transfer",
      amount: input.amount,
      accountId: input.fromAccountId,
      reason,
    });
    throw error;
  }
}

export async function submitBotAltaPay(
  userId: string,
  input: BotAltaPaySubmitInput,
): Promise<{
  referenceCode: string;
  amount: number;
  payeeName: string;
  fundingSourceLabel: string;
}> {
  const user = await loadAltaUserOrThrow(userId);

  try {
    if (input.recipient.kind === "company") {
      const result = await submitAltaPayPayment(
        user,
        {
          fundingSource: input.fundingSource,
          companyId: input.recipient.companyId,
          amount: input.amount,
          memo: input.memo,
        },
        BOT_STAFF_AUDIT,
      );
      return {
        referenceCode: result.referenceCode,
        amount: result.amount,
        payeeName: result.companyName,
        fundingSourceLabel: result.fundingSourceLabel,
      };
    }

    if (input.fundingSource.kind !== "bank_account") {
      badRequest("Payments to Alta customers require a bank account funding source.");
    }

    const result = await submitAltaPayToPerson(
      user,
      {
        fundingSource: input.fundingSource,
        recipientUserId: input.recipient.recipientUserId,
        amount: input.amount,
        memo: input.memo,
      },
      BOT_STAFF_AUDIT,
    );

    return {
      referenceCode: result.referenceCode,
      amount: result.amount,
      payeeName: result.companyName,
      fundingSourceLabel: result.fundingSourceLabel,
    };
  } catch (error) {
    const { notifyAltaPayFailedBestEffort, friendlyFailureReason } = await import(
      "@/server/banking-notification.service"
    );
    const { recordBotBankingActionFailedBestEffort, friendlyBotFailureReason } = await import(
      "@/server/bot-audit.service"
    );
    const payeeLabel =
      input.recipient.kind === "company" ? input.recipient.companyId : input.recipient.recipientUserId;
    const reason = friendlyBotFailureReason(error);
    void notifyAltaPayFailedBestEffort(userId, {
      amount: input.amount,
      reason: friendlyFailureReason(error),
      payeeLabel,
    });
    await recordBotBankingActionFailedBestEffort({
      userId,
      action: "alta_pay",
      amount: input.amount,
      reason,
      payeeLabel,
    });
    throw error;
  }
}

export async function quoteBotMerchantInvoicePayment(userId: string, invoiceId: string) {
  const user = await loadAltaUserOrThrow(userId);
  const { quoteMerchantInvoicePayment } = await import("@/server/merchant-invoice-payment.service");
  return quoteMerchantInvoicePayment(user, invoiceId);
}

export async function payBotMerchantInvoice(
  userId: string,
  input: {
    invoiceId: string;
    fundingAccountId: string;
    idempotencyKey: string;
  },
) {
  const user = await loadAltaUserOrThrow(userId);
  const { payMerchantInvoice } = await import("@/server/merchant-invoice-payment.service");
  return payMerchantInvoice(
    user,
    {
      invoiceId: input.invoiceId,
      fundingSource: { kind: "bank_account", accountId: input.fundingAccountId },
      idempotencyKey: input.idempotencyKey,
    },
    BOT_STAFF_AUDIT,
  );
}
