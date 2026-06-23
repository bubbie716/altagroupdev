import { PrismaClient } from "@prisma/client";
import { generateAccountNumber } from "../src/lib/bank/account-number";
import { fromDbBankAccountType } from "../src/server/bank-mapper";

const prisma = new PrismaClient();

async function generateUniqueAccountNumber(
  accountType: ReturnType<typeof fromDbBankAccountType>,
  reserved: Set<string>,
): Promise<string> {
  for (let attempt = 0; attempt < 24; attempt++) {
    const accountNumber = generateAccountNumber(accountType);
    if (reserved.has(accountNumber)) continue;

    const existing = await prisma.bankAccount.findUnique({ where: { accountNumber } });
    if (!existing) {
      reserved.add(accountNumber);
      return accountNumber;
    }
  }

  throw new Error("ACCOUNT_NUMBER_GENERATION_FAILED");
}

async function main() {
  const legacyAccounts = await prisma.bankAccount.findMany({
    where: {
      NOT: {
        accountNumber: { startsWith: "AB-" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (legacyAccounts.length === 0) {
    console.log("No legacy account numbers found. All accounts use AB-[PRODUCT]-[UNIQUE] format.");
    return;
  }

  const reserved = new Set(
    (
      await prisma.bankAccount.findMany({
        where: { accountNumber: { startsWith: "AB-" } },
        select: { accountNumber: true },
      })
    ).map((row) => row.accountNumber),
  );

  console.log(`Migrating ${legacyAccounts.length} legacy account number(s)…`);

  for (const account of legacyAccounts) {
    const accountType = fromDbBankAccountType(account.accountType);
    const nextAccountNumber = await generateUniqueAccountNumber(accountType, reserved);

    await prisma.bankAccount.update({
      where: { id: account.id },
      data: { accountNumber: nextAccountNumber },
    });

    console.log(
      `${account.accountName}: ${account.accountNumber} → ${nextAccountNumber}`,
    );
  }

  const remaining = await prisma.bankAccount.count({
    where: { NOT: { accountNumber: { startsWith: "AB-" } } },
  });

  if (remaining > 0) {
    throw new Error(`${remaining} account(s) still have legacy account numbers`);
  }

  console.log("Legacy account number migration complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
