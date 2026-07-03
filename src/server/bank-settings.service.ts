import type { UserNotificationType } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import type {
  DiscordNotificationPrefs,
  UpdateUserBankSettingsInput,
  UserBankSettingsView,
} from "@/lib/bank/bank-settings-types";
import { BANK_DISCORD_NOTIFICATION_OPTIONS } from "@/lib/bank/bank-settings-types";
import { prisma } from "@/server/db";
import { findAccessibleBankAccount } from "@/server/bank-account-access.service";

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function parseDiscordPrefs(value: unknown): DiscordNotificationPrefs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const prefs: DiscordNotificationPrefs = {};
  for (const option of BANK_DISCORD_NOTIFICATION_OPTIONS) {
    const raw = (value as Record<string, unknown>)[option.type];
    if (typeof raw === "boolean") prefs[option.type] = raw;
  }
  return prefs;
}

async function listReceiveAccountOptions(userId: string) {
  const accounts = await prisma.bankAccount.findMany({
    where: {
      userId,
      companyId: null,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "asc" },
  });

  return accounts.map((account) => ({
    id: account.id,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    ownerLabel: "Personal",
  }));
}

function oldestReceiveAccountOption(
  options: Awaited<ReturnType<typeof listReceiveAccountOptions>>,
) {
  return options[0] ?? null;
}

function effectiveReceiveAccountId(
  explicitAccountId: string | null | undefined,
  receiveAccountOptions: Awaited<ReturnType<typeof listReceiveAccountOptions>>,
): string | null {
  if (
    explicitAccountId &&
    receiveAccountOptions.some((account) => account.id === explicitAccountId)
  ) {
    return explicitAccountId;
  }
  return oldestReceiveAccountOption(receiveAccountOptions)?.id ?? null;
}

/** Resolve where Alta Pay person payments settle — explicit setting or oldest personal account. */
export async function resolveAltaPayReceiveAccount(userId: string): Promise<{
  id: string;
  accountName: string;
  accountNumber: string;
  status: "ACTIVE";
} | null> {
  const [settings, oldestAccount] = await Promise.all([
    prisma.userBankSettings.findUnique({
      where: { userId },
      select: {
        defaultAltaPayReceiveAccount: {
          select: { id: true, accountName: true, accountNumber: true, status: true },
        },
      },
    }),
    prisma.bankAccount.findFirst({
      where: { userId, companyId: null, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, accountName: true, accountNumber: true, status: true },
    }),
  ]);

  const configured = settings?.defaultAltaPayReceiveAccount;
  if (configured?.status === "ACTIVE") {
    return {
      id: configured.id,
      accountName: configured.accountName,
      accountNumber: configured.accountNumber,
      status: "ACTIVE",
    };
  }

  if (!oldestAccount || oldestAccount.status !== "ACTIVE") return null;

  return {
    id: oldestAccount.id,
    accountName: oldestAccount.accountName,
    accountNumber: oldestAccount.accountNumber,
    status: "ACTIVE",
  };
}

async function listFundingAccountOptions(user: AltaUser) {
  const { listPaySourceAccounts } = await import("@/server/alta-pay.service");
  const accounts = await listPaySourceAccounts(user);
  return accounts.map((account) => ({
    id: account.id,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    ownerLabel: account.isCompanyAccount ? account.companyName : "Personal",
  }));
}

export async function getUserBankSettings(user: AltaUser): Promise<UserBankSettingsView> {
  const [settings, receiveAccountOptions, fundingAccountOptions] = await Promise.all([
    prisma.userBankSettings.findUnique({ where: { userId: user.id } }),
    listReceiveAccountOptions(user.id),
    listFundingAccountOptions(user),
  ]);

  return {
    explicitDefaultAltaPayReceiveAccountId: settings?.defaultAltaPayReceiveAccountId ?? null,
    defaultAltaPayReceiveAccountId: effectiveReceiveAccountId(
      settings?.defaultAltaPayReceiveAccountId,
      receiveAccountOptions,
    ),
    defaultAltaPayFundingAccountId: settings?.defaultAltaPayFundingAccountId ?? null,
    discordNotificationPrefs: parseDiscordPrefs(settings?.discordNotificationPrefs),
    receiveAccountOptions,
    fundingAccountOptions,
  };
}

async function validateReceiveAccount(userId: string, accountId: string | null | undefined) {
  if (!accountId) return null;
  const account = await findAccessibleBankAccount(userId, accountId, "manage");
  if (!account) badRequest("Select a valid default Alta Pay receive account.");
  if (account.companyId !== null) {
    badRequest("Default Alta Pay receive account must be a personal Alta Bank account.");
  }
  if (account.status !== "ACTIVE") {
    badRequest("Default Alta Pay receive account must be active.");
  }
  return account.id;
}

async function validateFundingAccount(user: AltaUser, accountId: string | null | undefined) {
  if (!accountId) return null;
  const { listPaySourceAccounts } = await import("@/server/alta-pay.service");
  const allowed = await listPaySourceAccounts(user);
  if (!allowed.some((account) => account.id === accountId)) {
    badRequest("Select a valid default Alta Pay funding account.");
  }
  return accountId;
}

export async function updateUserBankSettings(
  user: AltaUser,
  input: UpdateUserBankSettingsInput,
): Promise<UserBankSettingsView> {
  const receiveAccountId =
    input.defaultAltaPayReceiveAccountId !== undefined
      ? await validateReceiveAccount(user.id, input.defaultAltaPayReceiveAccountId)
      : undefined;
  const fundingAccountId =
    input.defaultAltaPayFundingAccountId !== undefined
      ? await validateFundingAccount(user, input.defaultAltaPayFundingAccountId)
      : undefined;

  const existing = await prisma.userBankSettings.findUnique({ where: { userId: user.id } });
  const nextPrefs =
    input.discordNotificationPrefs !== undefined
      ? {
          ...parseDiscordPrefs(existing?.discordNotificationPrefs),
          ...input.discordNotificationPrefs,
        }
      : undefined;

  await prisma.userBankSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      defaultAltaPayReceiveAccountId: receiveAccountId ?? null,
      defaultAltaPayFundingAccountId: fundingAccountId ?? null,
      discordNotificationPrefs: nextPrefs ?? {},
    },
    update: {
      ...(receiveAccountId !== undefined ? { defaultAltaPayReceiveAccountId: receiveAccountId } : {}),
      ...(fundingAccountId !== undefined ? { defaultAltaPayFundingAccountId: fundingAccountId } : {}),
      ...(nextPrefs !== undefined ? { discordNotificationPrefs: nextPrefs } : {}),
    },
  });

  return getUserBankSettings(user);
}

export async function isDiscordNotificationEnabled(
  userId: string,
  type: UserNotificationType,
): Promise<boolean> {
  const settings = await prisma.userBankSettings.findUnique({
    where: { userId },
    select: { discordNotificationPrefs: true },
  });
  if (!settings) return true;
  const prefs = parseDiscordPrefs(settings.discordNotificationPrefs);
  if (prefs[type] === undefined) return true;
  return prefs[type] !== false;
}
