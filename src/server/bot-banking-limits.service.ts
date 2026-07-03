import { formatFlorin } from "@/lib/bank/format";
import { prisma } from "@/server/db";

export const DISCORD_BANKING_LIMITS = {
  dailyFreeTransferVolume: 25_000,
  maxTransferAmount: 100_000,
  maxDepositRequestAmount: 250_000,
  maxWithdrawalRequestAmount: 100_000,
  convenienceFeeRate: 0.0025,
  minConvenienceFee: 50,
  maxConvenienceFee: 1_000,
} as const;

export type BotTransferQuote = {
  allowed: boolean;
  reason?: string;
  transferAmount: number;
  convenienceFee: number;
  totalDebited: number;
  recipientReceives: number;
  dailyVolumeBefore: number;
  dailyVolumeAfter: number;
  requiresWebsite: boolean;
};

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function utcDateOnly(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function websiteRedirectMessage(action: string): string {
  return `${action} exceeds Discord banking limits. Please continue on Alta Bank.`;
}

export async function getBotDailyTransferVolume(userId: string, onDate = new Date()): Promise<number> {
  const usageDate = utcDateOnly(onDate);
  const row = await prisma.botDailyTransferUsage.findUnique({
    where: { userId_usageDate: { userId, usageDate } },
    select: { volume: true },
  });
  return row ? Number(row.volume) : 0;
}

function computeConvenienceFee(dailyVolumeBefore: number, transferAmount: number): number {
  const { dailyFreeTransferVolume, convenienceFeeRate, minConvenienceFee, maxConvenienceFee } =
    DISCORD_BANKING_LIMITS;

  const remainingFree = Math.max(0, dailyFreeTransferVolume - dailyVolumeBefore);
  const taxableAmount = Math.max(0, transferAmount - remainingFree);
  if (taxableAmount <= 0) return 0;

  const rawFee = taxableAmount * convenienceFeeRate;
  return roundMoney(Math.min(maxConvenienceFee, Math.max(minConvenienceFee, rawFee)));
}

export async function quoteBotTransfer(userId: string, amount: number): Promise<BotTransferQuote> {
  if (amount <= 0) {
    return {
      allowed: false,
      reason: "Amount must be greater than zero.",
      transferAmount: amount,
      convenienceFee: 0,
      totalDebited: amount,
      recipientReceives: amount,
      dailyVolumeBefore: 0,
      dailyVolumeAfter: 0,
      requiresWebsite: false,
    };
  }

  if (amount > DISCORD_BANKING_LIMITS.maxTransferAmount) {
    return {
      allowed: false,
      reason: websiteRedirectMessage("This transfer"),
      transferAmount: amount,
      convenienceFee: 0,
      totalDebited: amount,
      recipientReceives: amount,
      dailyVolumeBefore: 0,
      dailyVolumeAfter: amount,
      requiresWebsite: true,
    };
  }

  const dailyVolumeBefore = await getBotDailyTransferVolume(userId);
  const convenienceFee = computeConvenienceFee(dailyVolumeBefore, amount);

  return {
    allowed: true,
    transferAmount: amount,
    convenienceFee,
    totalDebited: roundMoney(amount + convenienceFee),
    recipientReceives: amount,
    dailyVolumeBefore,
    dailyVolumeAfter: roundMoney(dailyVolumeBefore + amount),
    requiresWebsite: false,
  };
}

export function assertBotDepositLimit(amount: number): void {
  if (amount <= 0) badRequest("Amount must be greater than zero.");
  if (amount > DISCORD_BANKING_LIMITS.maxDepositRequestAmount) {
    badRequest(websiteRedirectMessage("This deposit"));
  }
}

export function assertBotWithdrawalLimit(amount: number): void {
  if (amount <= 0) badRequest("Amount must be greater than zero.");
  if (amount > DISCORD_BANKING_LIMITS.maxWithdrawalRequestAmount) {
    badRequest(websiteRedirectMessage("This withdrawal"));
  }
}

export async function assertBotTransferAllowed(userId: string, amount: number): Promise<BotTransferQuote> {
  const quote = await quoteBotTransfer(userId, amount);
  if (!quote.allowed) badRequest(quote.reason ?? "This transfer is not allowed.");
  return quote;
}

export async function recordBotTransferUsage(userId: string, amount: number): Promise<void> {
  const usageDate = utcDateOnly();
  await prisma.botDailyTransferUsage.upsert({
    where: { userId_usageDate: { userId, usageDate } },
    create: { userId, usageDate, volume: amount },
    update: { volume: { increment: amount } },
  });
}

export function formatBotTransferQuoteLines(quote: BotTransferQuote): string[] {
  const lines = [
    `**Transfer amount** ${formatFlorin(quote.transferAmount)}`,
    `**Recipient receives** ${formatFlorin(quote.recipientReceives)}`,
  ];

  if (quote.convenienceFee > 0) {
    lines.push(`**Discord banking fee** ${formatFlorin(quote.convenienceFee)}`);
    lines.push(`**Total debited** ${formatFlorin(quote.totalDebited)}`);
  } else {
    lines.push(`**Total debited** ${formatFlorin(quote.totalDebited)}`);
  }

  const freeRemaining = Math.max(
    0,
    DISCORD_BANKING_LIMITS.dailyFreeTransferVolume - quote.dailyVolumeAfter,
  );
  lines.push(`**Free transfer remaining today** ${formatFlorin(freeRemaining)}`);

  return lines;
}
