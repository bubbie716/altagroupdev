import { UserTag, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TAG_ALIASES: Record<string, UserTag> = {
  admin: UserTag.CORPORATE_ADMIN,
  corporate_admin: UserTag.CORPORATE_ADMIN,
  bank_admin: UserTag.BANK_ADMIN,
  terminal_admin: UserTag.TERMINAL_ADMIN,
};

const TAG_LABELS: Partial<Record<UserTag, string>> = {
  [UserTag.CORPORATE_ADMIN]: "corporate_admin",
  [UserTag.BANK_ADMIN]: "bank_admin",
  [UserTag.TERMINAL_ADMIN]: "terminal_admin",
};

function tagLabel(tag: UserTag): string {
  return TAG_LABELS[tag] ?? tag.toLowerCase();
}

function parseTag(value: string): UserTag {
  const normalized = value.trim().toLowerCase();
  const tag = TAG_ALIASES[normalized];
  if (!tag) {
    throw new Error(
      `Unknown tag "${value}". Use: corporate_admin, bank_admin, terminal_admin (admin → corporate_admin)`,
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
  return tags.length === 0 ? "(none)" : tags.map(tagLabel).join(", ");
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const remove = args.includes("--remove");
  const positional = args.filter((arg) => arg !== "--remove");

  const discordId = positional[0]?.trim();
  const tagArgs = positional.slice(1).map((arg) => arg.trim()).filter(Boolean);

  if (!discordId || tagArgs.length === 0) {
    console.error("Usage: npm run db:grant-tag -- <discordId> <tag> [tag2 ...] [--remove]");
    console.error("Example: npm run db:grant-tag -- 123456789012345678 corporate_admin bank_admin");
    console.error("Tags: corporate_admin, bank_admin, terminal_admin (admin aliases corporate_admin)");
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

    const remaining = await listUserTags(user.id);
    console.log(
      `Removed ${tags.map(tagLabel).join(", ")} from ${user.discordUsername} (${discordId})`,
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

  const current = await listUserTags(user.id);
  console.log(
    `Granted ${tags.map(tagLabel).join(", ")} to ${user.discordUsername} (${discordId})`,
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
