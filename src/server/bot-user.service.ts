import { prisma } from "@/server/db";

export type BotLinkedUser = {
  id: string;
  discordId: string;
  discordUsername: string;
};

export class BotUserNotLinkedError extends Error {
  constructor() {
    super("NOT_LINKED");
    this.name = "BotUserNotLinkedError";
  }
}

/** Resolve a Discord snowflake to an Alta user. Never creates users. */
export async function getUserByDiscordId(discordId: string): Promise<BotLinkedUser | null> {
  const user = await prisma.user.findUnique({
    where: { discordId },
    select: { id: true, discordId: true, discordUsername: true },
  });
  return user;
}

/** Require a linked Alta user for bot interactions. */
export async function requireBotUser(discordId: string): Promise<BotLinkedUser> {
  const user = await getUserByDiscordId(discordId);
  if (!user) {
    throw new BotUserNotLinkedError();
  }
  return user;
}
