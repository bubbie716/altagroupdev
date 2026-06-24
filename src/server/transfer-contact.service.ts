import type { Prisma } from "@prisma/client";
import type {
  CreateInterbankTransferContactInput,
  CreateIntrabankTransferContactInput,
  IntrabankContactKindCode,
  TransferContact,
  TransferContactScopeCode,
} from "@/lib/bank/backend-types";
import { isValidAltaAccountNumber } from "@/lib/bank/account-number";
import { prisma } from "@/server/db";

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function normalizeAccountNumber(input: string): string {
  return input.trim().toUpperCase();
}

async function getUserCompanyIds(userId: string): Promise<Set<string>> {
  const memberships = await prisma.companyMembership.findMany({
    where: { userId },
    select: { companyId: true },
  });
  return new Set(memberships.map((m) => m.companyId));
}

function accessibleAccountWhere(userId: string, companyIds: Set<string>): Prisma.BankAccountWhereInput {
  return {
    OR: [
      { userId, companyId: null },
      ...(companyIds.size > 0 ? [{ companyId: { in: [...companyIds] } }] : []),
    ],
  };
}

async function isAccountAccessibleByUser(accountId: string, userId: string): Promise<boolean> {
  const companyIds = await getUserCompanyIds(userId);
  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, ...accessibleAccountWhere(userId, companyIds) },
    select: { id: true },
  });
  return !!account;
}

function mapScope(scope: "INTRABANK" | "INTERBANK"): TransferContactScopeCode {
  return scope === "INTRABANK" ? "intrabank" : "interbank";
}

function mapIntrabankKind(
  kind: "OWN_ACCOUNT" | "PLAYER_ACCOUNT" | null,
): IntrabankContactKindCode | null {
  if (!kind) return null;
  return kind === "OWN_ACCOUNT" ? "own_account" : "player_account";
}

function mapTransferContact(row: {
  id: string;
  scope: "INTRABANK" | "INTERBANK";
  label: string;
  intrabankKind: "OWN_ACCOUNT" | "PLAYER_ACCOUNT" | null;
  bankAccountId: string | null;
  accountNumber: string | null;
  resolvedName: string | null;
  recipientInstitution: string | null;
  recipientName: string | null;
  routingNumber: string | null;
  wireAccountNumber: string | null;
  createdAt: Date;
}): TransferContact {
  return {
    id: row.id,
    scope: mapScope(row.scope),
    label: row.label,
    intrabankKind: mapIntrabankKind(row.intrabankKind),
    bankAccountId: row.bankAccountId,
    accountNumber: row.accountNumber,
    resolvedName: row.resolvedName,
    recipientInstitution: row.recipientInstitution,
    recipientName: row.recipientName ?? row.label,
    routingNumber: row.routingNumber,
    wireAccountNumber: row.wireAccountNumber,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTransferContacts(
  userId: string,
  scope?: TransferContactScopeCode,
): Promise<TransferContact[]> {
  const contacts = await prisma.transferContact.findMany({
    where: {
      userId,
      ...(scope === "intrabank"
        ? { scope: "INTRABANK", intrabankKind: "PLAYER_ACCOUNT" }
        : scope === "interbank"
          ? { scope: "INTERBANK" }
          : {
              OR: [
                { scope: "INTERBANK" },
                { scope: "INTRABANK", intrabankKind: "PLAYER_ACCOUNT" },
              ],
            }),
    },
    orderBy: [{ scope: "asc" }, { label: "asc" }],
  });
  return contacts.map(mapTransferContact);
}

export async function createIntrabankTransferContact(
  userId: string,
  input: CreateIntrabankTransferContactInput,
): Promise<TransferContact> {
  const recipientName = input.recipientName.trim();
  if (!recipientName) badRequest("Recipient name is required");

  const accountNumber = normalizeAccountNumber(input.accountNumber);
  if (!isValidAltaAccountNumber(accountNumber)) {
    badRequest("Enter a valid Alta Bank account number (AB-####-######)");
  }

  const recipient = await prisma.bankAccount.findUnique({ where: { accountNumber } });
  if (!recipient) badRequest("Recipient account not found");
  if (recipient.status !== "ACTIVE") badRequest("Recipient account must be active");
  if (await isAccountAccessibleByUser(recipient.id, userId)) {
    badRequest("Use the account dropdown to transfer between your own accounts");
  }

  const contact = await prisma.transferContact.create({
    data: {
      userId,
      scope: "INTRABANK",
      label: recipientName,
      recipientName,
      intrabankKind: "PLAYER_ACCOUNT",
      accountNumber: recipient.accountNumber,
      resolvedName: recipient.accountName,
    },
  });
  return mapTransferContact(contact);
}

export async function createInterbankTransferContact(
  userId: string,
  input: CreateInterbankTransferContactInput,
): Promise<TransferContact> {
  const recipientInstitution = input.recipientInstitution.trim();
  const recipientName = input.recipientName.trim();
  const routingNumber = input.routingNumber.trim();
  const wireAccountNumber = input.wireAccountNumber.trim();

  if (!recipientInstitution) badRequest("Recipient institution is required");
  if (!recipientName) badRequest("Recipient name is required");
  if (!routingNumber) badRequest("Routing number is required");
  if (!wireAccountNumber) badRequest("Account number is required");

  const contact = await prisma.transferContact.create({
    data: {
      userId,
      scope: "INTERBANK",
      label: recipientName,
      recipientInstitution,
      recipientName,
      routingNumber,
      wireAccountNumber,
    },
  });
  return mapTransferContact(contact);
}

export async function deleteTransferContact(userId: string, contactId: string): Promise<void> {
  const contact = await prisma.transferContact.findUnique({ where: { id: contactId } });
  if (!contact) notFound();
  if (contact.userId !== userId) forbidden();
  await prisma.transferContact.delete({ where: { id: contactId } });
}
