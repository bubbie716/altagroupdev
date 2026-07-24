import { UserTag, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TAG_ALIASES: Record<string, UserTag> = {
  admin: UserTag.CORPORATE_ADMIN,
  corporate_admin: UserTag.CORPORATE_ADMIN,
  bank_admin: UserTag.BANK_ADMIN,
  terminal_admin: UserTag.TERMINAL_ADMIN,
  private_client: UserTag.PRIVATE_CLIENT,
  private: UserTag.PRIVATE_CLIENT,
};

const TAG_LABELS: Record<UserTag, string> = {
  [UserTag.CORPORATE_ADMIN]: "corporate_admin",
  [UserTag.BANK_ADMIN]: "bank_admin",
  [UserTag.TERMINAL_ADMIN]: "terminal_admin",
  [UserTag.PRIVATE_CLIENT]: "private_client",
};

function parseTag(value: string): UserTag {
  const normalized = value.trim().toLowerCase();
  const tag = TAG_ALIASES[normalized];
  if (!tag) {
    throw new Error(
      `Unknown tag "${value}". Use: corporate_admin, bank_admin, terminal_admin, private_client (admin → corporate_admin)`,
    );
  }
  return tag;
}

async function listUserTags(userId: string): Promise<UserTag[]> {
  const rows = await prisma.userTagAssignment.findMany({
    where: { userId },
    orderBy: { tag: "asc" },
  });
  return rows.map((row) => row.tag);
}

function formatTagList(tags: UserTag[]): string {
  return tags.length === 0 ? "(none)" : tags.map((tag) => TAG_LABELS[tag]).join(", ");
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const remove = args.includes("--remove");
  const positional = args.filter((arg) => arg !== "--remove");

  const discordId = positional[0]?.trim();
  const tagArgs = positional.slice(1).map((arg) => arg.trim()).filter(Boolean);

  if (!discordId || tagArgs.length === 0) {
    console.error("Usage: npm run db:grant-tag -- <discordId> <tag> [tag2 ...] [--remove]");
    console.error("Example: npm run db:grant-tag -- 123456789012345678 corporate_admin private_client");
    console.error("Tags: corporate_admin, bank_admin, terminal_admin, private_client (admin aliases corporate_admin)");
    process.exit(1);
  }

  const tags = tagArgs.map(parseTag);
  const user = await prisma.user.findUnique({ where: { discordId } });
  if (!user) {
    console.error(`No user found with discordId ${discordId}. Sign in once, then retry.`);
    process.exit(1);
  }

  if (remove) {
    await prisma.userTagAssignment.deleteMany({
      where: { userId: user.id, tag: { in: tags } },
    });

    if (tags.includes(UserTag.PRIVATE_CLIENT)) {
      const { liquidatePrivateBankingOnAccessRevoked } = await import("../src/server/bank.service");
      const result = await liquidatePrivateBankingOnAccessRevoked(user.id);
      if (result.accountsClosed > 0) {
        console.log(
          `Liquidated ${result.accountsClosed} private account(s); transferred ${result.totalTransferred} FLR.`,
        );
      }
    }

    const remaining = await listUserTags(user.id);
    console.log(
      `Removed ${tags.map((tag) => TAG_LABELS[tag]).join(", ")} from ${user.discordUsername} (${discordId})`,
    );
    console.log(`Current tags: ${formatTagList(remaining)}`);
    return;
  }

  for (const tag of tags) {
    await prisma.userTagAssignment.upsert({
      where: { userId_tag: { userId: user.id, tag } },
      create: { userId: user.id, tag },
      update: {},
    });
  }

  if (tags.includes(UserTag.PRIVATE_CLIENT)) {
    const { finalizeAltaPrivateMembershipActivation } = await import(
      "../src/server/alta-private-timeline.service"
    );
    await finalizeAltaPrivateMembershipActivation(user.id);
  }

  const current = await listUserTags(user.id);
  console.log(
    `Granted ${tags.map((tag) => TAG_LABELS[tag]).join(", ")} to ${user.discordUsername} (${discordId})`,
  );
  console.log(`Current tags: ${formatTagList(current)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
