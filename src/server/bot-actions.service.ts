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
  searchPayableCompanies,
  submitAltaPayPayment,
} from "@/server/alta-pay.service";
import { loadAltaUserOrThrow } from "@/server/bank-account-access.service";
import {
  listUserBankAccounts,
  submitDepositRequest,
  submitInternalTransfer,
  submitWithdrawalRequest,
} from "@/server/bank.service";

export type BotActionAccount = {
  id: string;
  accountName: string;
  accountNumber: string;
  availableBalance: number;
  isCompanyAccount: boolean;
  companyName: string | null;
};

export type BotPayContext = {
  fundingSources: Awaited<ReturnType<typeof listPayFundingSources>>;
  companies: Awaited<ReturnType<typeof searchPayableCompanies>>;
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
  const [fundingSources, companies] = await Promise.all([
    listPayFundingSources(user),
    searchPayableCompanies(""),
  ]);
  return { fundingSources, companies };
}

export async function searchBotPayCompanies(query: string) {
  return searchPayableCompanies(query);
}

export async function submitBotDeposit(
  userId: string,
  input: { bankAccountId: string; amount: number; memo?: string },
  file: { name: string; type: string; size: number; buffer: Buffer },
): Promise<{ transactionId: string; referenceCode: string }> {
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
  return submitWithdrawalRequest(userId, input);
}

export async function submitBotTransfer(
  userId: string,
  input: { fromAccountId: string; toAccountId: string; amount: number; memo?: string },
): Promise<{ referenceCode: string }> {
  return submitInternalTransfer(userId, {
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: input.amount,
    memo: input.memo,
  });
}

export async function submitBotAltaPay(
  userId: string,
  input: SubmitAltaPayInput,
): Promise<Awaited<ReturnType<typeof submitAltaPayPayment>>> {
  const user = await loadAltaUserOrThrow(userId);
  return submitAltaPayPayment(user, input);
}
