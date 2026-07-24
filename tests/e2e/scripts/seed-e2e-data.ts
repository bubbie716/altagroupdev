import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  BankAccountStatus,
  BankAccountType,
  BankTransactionStatus,
  BankTransactionType,
  CompanyRole,
  PrismaClient,
  UserTag,
} from "@prisma/client";
import type { E2eManifest, E2eRole } from "../utils/test-users.js";
import { E2E_DISCORD_IDS, E2E_MANIFEST_PATH } from "../utils/test-users.js";
import { assertSafeTestEnvironment } from "../utils/env.js";

const prisma = new PrismaClient();

const ROLE_TAGS: Record<E2eRole, UserTag[]> = {
  customer: [],
  businessOwner: [],
  financeManager: [],
  operator: [UserTag.BANK_ADMIN],
  admin: [UserTag.CORPORATE_ADMIN],
};

const ROLE_USERNAMES: Record<E2eRole, string> = {
  customer: "e2e-customer",
  businessOwner: "e2e-business-owner",
  financeManager: "e2e-finance-manager",
  operator: "e2e-operator",
  admin: "e2e-admin",
};

function sessionToken(): string {
  return randomBytes(32).toString("hex");
}

async function upsertE2eUser(role: E2eRole) {
  const discordId = E2E_DISCORD_IDS[role];
  const user = await prisma.user.upsert({
    where: { discordId },
    create: {
      discordId,
      discordUsername: ROLE_USERNAMES[role],
      email: `${role}@e2e.alta.local`,
      minecraftUsername: `E2E_${role}`,
    },
    update: {
      discordUsername: ROLE_USERNAMES[role],
      accountStatus: "ACTIVE",
    },
  });

  await prisma.userTagAssignment.deleteMany({ where: { userId: user.id } });
  for (const tag of ROLE_TAGS[role]) {
    await prisma.userTagAssignment.create({ data: { userId: user.id, tag } });
  }

  return user;
}

async function upsertCheckingAccount(userId: string, accountNumber: string, accountName: string) {
  return prisma.bankAccount.upsert({
    where: { accountNumber },
    create: {
      userId,
      accountType: BankAccountType.CHECKING,
      accountName,
      accountNumber,
      status: BankAccountStatus.ACTIVE,
      balance: 5000,
    },
    update: {
      userId,
      status: BankAccountStatus.ACTIVE,
      accountName,
    },
  });
}

export async function seedE2eData(): Promise<E2eManifest> {
  assertSafeTestEnvironment();

  const users = {} as E2eManifest["users"];
  for (const role of Object.keys(E2E_DISCORD_IDS) as E2eRole[]) {
    const user = await upsertE2eUser(role);
    users[role] = { id: user.id, discordId: user.discordId, username: user.discordUsername };
  }

  const customerChecking = await upsertCheckingAccount(
    users.customer.id,
    "AB-E2E-001-CHKG",
    "E2E Checking",
  );
  const customerSavings = await upsertCheckingAccount(
    users.customer.id,
    "AB-E2E-001-SAVG",
    "E2E Savings",
  );
  await prisma.bankAccount.update({
    where: { id: customerSavings.id },
    data: { accountType: BankAccountType.SAVINGS, balance: 1200 },
  });

  const harbor = await prisma.company.findUnique({ where: { id: "CO-HBR" } });
  const npc = await prisma.company.findUnique({ where: { id: "CO-NPC" } });

  if (harbor) {
    await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: users.businessOwner.id, companyId: harbor.id } },
      create: { userId: users.businessOwner.id, companyId: harbor.id, role: CompanyRole.OWNER },
      update: { role: CompanyRole.OWNER },
    });
  }

  if (npc) {
    await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: users.financeManager.id, companyId: npc.id } },
      create: {
        userId: users.financeManager.id,
        companyId: npc.id,
        role: CompanyRole.FINANCE_MANAGER,
      },
      update: { role: CompanyRole.FINANCE_MANAGER },
    });
  }

  let businessOperatingId: string | null = null;
  if (harbor) {
    const operating = await prisma.bankAccount.upsert({
      where: { accountNumber: "AB-E2E-HBR-OPER" },
      create: {
        userId: users.businessOwner.id,
        companyId: harbor.id,
        accountType: BankAccountType.BUSINESS_OPERATING,
        accountName: "Harbor Operating",
        accountNumber: "AB-E2E-HBR-OPER",
        status: BankAccountStatus.ACTIVE,
        balance: 25000,
      },
      update: { status: BankAccountStatus.ACTIVE },
    });
    businessOperatingId = operating.id;
  }

  const pendingDeposit = await prisma.bankTransaction.create({
    data: {
      bankAccountId: customerChecking.id,
      type: BankTransactionType.DEPOSIT,
      amount: 250,
      status: BankTransactionStatus.PENDING,
      description: "E2E pending deposit",
      referenceCode: `E2E-DEP-${Date.now()}`,
    },
  });

  const pendingWithdrawal = await prisma.bankTransaction.create({
    data: {
      bankAccountId: customerChecking.id,
      type: BankTransactionType.WITHDRAWAL,
      amount: 100,
      status: BankTransactionStatus.PENDING,
      description: "E2E pending withdrawal",
      referenceCode: `E2E-WD-${Date.now()}`,
    },
  });

  const manifest: E2eManifest = {
    seededAt: new Date().toISOString(),
    users,
    accounts: {
      customerCheckingId: customerChecking.id,
      customerCheckingNumber: customerChecking.accountNumber,
      customerSavingsId: customerSavings.id,
      businessOperatingId,
    },
    companies: { harborId: harbor?.id ?? "CO-HBR", npcId: npc?.id ?? "CO-NPC" },
    pending: {
      depositTransactionId: pendingDeposit.id,
      withdrawalTransactionId: pendingWithdrawal.id,
    },
  };

  const manifestPath = path.resolve(E2E_MANIFEST_PATH);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  return manifest;
}

export async function createSessionForUser(userId: string): Promise<string> {
  const token = sessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { userId, sessionToken: token, expiresAt } });
  return token;
}

export async function runSeedCli(): Promise<void> {
  const manifest = await seedE2eData();
  console.log(`E2E seed complete. Customer account: ${manifest.accounts.customerCheckingNumber}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeedCli()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
