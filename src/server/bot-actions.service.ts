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
  quoteBotTransfer,
  recordBotTransferUsage,
  type BotTransferQuote,
} from "@/server/bot-banking-limits.service";
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

export async function getBotPayContext(userId: string): Promise<BotPayContext> {
  const user = await loadAltaUserOrThrow(userId);
  const fundingSources = await listPayFundingSources(user);
  return { fundingSources };
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

async function collectDiscordTransferFee(
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
}

export async function submitBotDeposit(
  userId: string,
  input: { bankAccountId: string; amount: number; memo?: string },
  file: { name: string; type: string; size: number; buffer: Buffer },
): Promise<{ transactionId: string; referenceCode: string }> {
  assertBotDepositLimit(input.amount);

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

  return submitDepositRequest(
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
  );
}

export async function submitBotWithdrawal(
  userId: string,
  input: { bankAccountId: string; amount: number; memo?: string },
): Promise<{ transactionId: string; referenceCode: string }> {
  assertBotWithdrawalLimit(input.amount);

  return submitWithdrawalRequest(userId, input);
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

  const result = await submitInternalTransfer(userId, {
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: input.amount,
    memo: input.memo,
  });

  await collectDiscordTransferFee(input.fromAccountId, quote.convenienceFee, result.referenceCode);
  await recordBotTransferUsage(userId, input.amount);

  return result;
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

  if (input.recipient.kind === "company") {
    const result = await submitAltaPayPayment(user, {
      fundingSource: input.fundingSource,
      companyId: input.recipient.companyId,
      amount: input.amount,
      memo: input.memo,
    });
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

  const result = await submitAltaPayToPerson(user, {
    fundingSource: input.fundingSource,
    recipientUserId: input.recipient.recipientUserId,
    amount: input.amount,
    memo: input.memo,
  });

  return {
    referenceCode: result.referenceCode,
    amount: result.amount,
    payeeName: result.companyName,
    fundingSourceLabel: result.fundingSourceLabel,
  };
}
