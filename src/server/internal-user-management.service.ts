import type { AccountStatus, AltaUser, UserTag } from "@/lib/auth/types";
import { formatUserTag } from "@/lib/auth/tags";
import { isAdmin, isOperator } from "@/lib/auth/permissions";
import type {
  InternalAccessMetrics,
  InternalUserDetail,
  InternalUserListFilters,
  InternalUserListRow,
  InternalUserManagementCapabilities,
  InternalUserTagAction,
} from "@/lib/internal/user-management.types";
import { ALL_USER_TAGS } from "@/lib/internal/user-management.types";
import { prisma } from "@/server/db";
import {
  fromDbAccountStatus,
  fromDbCompanyRole,
  fromDbUserTag,
  toDbAccountStatus,
  toDbUserTag,
} from "@/server/enum-map";
import { requireOperator } from "@/server/permissions.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { formatBankAccountTypeLabel } from "@/lib/bank/backend-types";
import type { Prisma } from "@prisma/client";
import { fromDbBankAccountType } from "@/server/bank-mapper";
import { COMPANY_ROLE_LABELS } from "@/lib/bank/business-banking-types";

const STAFF_TAGS: UserTag[] = ["admin", "operator"];
const OPERATOR_MANAGEABLE_TAGS: UserTag[] = ["developer", "issuer"];

function forbid(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

function discordAvatarUrl(discordId: string, avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`;
}

function buildListWhere(filters: InternalUserListFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { discordUsername: { contains: q, mode: "insensitive" } },
        { minecraftUsername: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const discordId = filters.discordId?.trim();
  if (discordId) {
    and.push({ discordId: { contains: discordId } });
  }

  if (filters.tag) {
    and.push({ tags: { some: { tag: toDbUserTag(filters.tag) } } });
  }

  if (filters.accountStatus) {
    and.push({ accountStatus: toDbAccountStatus(filters.accountStatus) });
  }

  return and.length > 0 ? { AND: and } : {};
}

function assertActorCanModifyTag(actor: AltaUser, tag: UserTag, action: "grant" | "revoke"): void {
  if (isAdmin(actor)) return;

  if (!isOperator(actor)) forbid();

  if (STAFF_TAGS.includes(tag)) {
    badRequest(`Operators cannot ${action} the ${formatUserTag(tag)} tag.`);
  }

  if (!OPERATOR_MANAGEABLE_TAGS.includes(tag)) {
    badRequest(`Operators cannot ${action} the ${formatUserTag(tag)} tag.`);
  }
}

async function assertNotLastAdmin(targetUserId: string, tag: UserTag): Promise<void> {
  if (tag !== "admin") return;

  const hasAdmin = await prisma.userTagAssignment.findUnique({
    where: { userId_tag: { userId: targetUserId, tag: "ADMIN" } },
  });
  if (!hasAdmin) return;

  const adminCount = await prisma.userTagAssignment.count({ where: { tag: "ADMIN" } });
  if (adminCount <= 1) {
    badRequest("Cannot remove the last admin on the platform.");
  }
}

function assertNotSelfAdminChange(actor: AltaUser, targetUserId: string, tag: UserTag): void {
  if (actor.id === targetUserId && tag === "admin") {
    badRequest("You cannot modify your own admin tag.");
  }
}

function buildTagCapabilities(actor: AltaUser, targetTags: UserTag[]): InternalUserManagementCapabilities["tags"] {
  const result = {} as Record<UserTag, InternalUserTagAction>;

  for (const tag of ALL_USER_TAGS) {
    const hasTag = targetTags.includes(tag);
    const isStaffTag = STAFF_TAGS.includes(tag);
    const adminActor = isAdmin(actor);
    const operatorActor = isOperator(actor) && !adminActor;

    let canGrant = false;
    let canRevoke = false;

    if (adminActor) {
      canGrant = !hasTag;
      canRevoke = hasTag;
    } else if (operatorActor && OPERATOR_MANAGEABLE_TAGS.includes(tag)) {
      canGrant = !hasTag;
      canRevoke = hasTag;
    }

    result[tag] = {
      canGrant,
      canRevoke,
      requiresConfirm:
        tag === "admin" || (tag === "operator" && hasTag),
      danger: isStaffTag,
    };
  }

  return result;
}

function buildStatusCapabilities(actor: AltaUser): Pick<
  InternalUserManagementCapabilities,
  "allowedAccountStatuses" | "canChangeAccountStatus"
> {
  if (isAdmin(actor)) {
    return {
      canChangeAccountStatus: true,
      allowedAccountStatuses: ["active", "restricted", "frozen", "pending_review"],
    };
  }

  if (isOperator(actor)) {
    return {
      canChangeAccountStatus: true,
      allowedAccountStatuses: ["pending_review", "restricted"],
    };
  }

  return { canChangeAccountStatus: false, allowedAccountStatuses: [] };
}

function mapListRow(user: {
  id: string;
  discordId: string;
  discordUsername: string;
  minecraftUsername: string | null;
  accountStatus: import("@prisma/client").AccountStatus;
  lastLoginAt: Date;
  createdAt: Date;
  tags: { tag: import("@prisma/client").UserTag }[];
  _count: { companyMemberships: number; bankAccounts: number };
}): InternalUserListRow {
  return {
    id: user.id,
    discordUsername: user.discordUsername,
    discordId: user.discordId,
    email: user.email,
    minecraftUsername: user.minecraftUsername,
    accountStatus: fromDbAccountStatus(user.accountStatus),
    tags: user.tags.map((t) => fromDbUserTag(t.tag)),
    companyCount: user._count.companyMemberships,
    bankAccountCount: user._count.bankAccounts,
    totalBankBalance:
      "bankAccounts" in user && Array.isArray(user.bankAccounts)
        ? user.bankAccounts.reduce((sum, a) => sum + decimalToNumber(a.balance), 0)
        : 0,
    lastLoginAt: user.lastLoginAt.toISOString(),
    createdAt: user.createdAt.toISOString(),
  };
}

export async function queryInternalAccessMetrics(): Promise<InternalAccessMetrics> {
  await requireOperator();

  const [
    totalUsers,
    admins,
    operators,
    privateClients,
    developers,
    issuers,
    restrictedUsers,
    frozenUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.userTagAssignment.count({ where: { tag: "ADMIN" } }),
    prisma.userTagAssignment.count({ where: { tag: "OPERATOR" } }),
    prisma.userTagAssignment.count({ where: { tag: "PRIVATE_CLIENT" } }),
    prisma.userTagAssignment.count({ where: { tag: "DEVELOPER" } }),
    prisma.userTagAssignment.count({ where: { tag: "ISSUER" } }),
    prisma.user.count({ where: { accountStatus: "RESTRICTED" } }),
    prisma.user.count({ where: { accountStatus: "FROZEN" } }),
  ]);

  return {
    totalUsers,
    admins,
    operators,
    privateClients,
    developers,
    issuers,
    restrictedUsers,
    frozenUsers,
  };
}

export async function listInternalUsers(
  filters: InternalUserListFilters = {},
): Promise<InternalUserListRow[]> {
  await requireOperator();

  const rows = await prisma.user.findMany({
    where: buildListWhere(filters),
    include: {
      tags: true,
      bankAccounts: { select: { balance: true } },
      _count: {
        select: {
          companyMemberships: true,
          bankAccounts: true,
        },
      },
    },
    orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return rows.map(mapListRow);
}

export async function getInternalUserDetail(userId: string): Promise<InternalUserDetail> {
  const actor = await requireOperator();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      ...userWithMembershipsInclude,
      bankAccounts: {
        include: { company: true },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          companyMemberships: true,
          bankAccounts: true,
        },
      },
    },
  });

  if (!user) notFound();

  const tags = user.tags.map((t) => fromDbUserTag(t.tag));

  const recentTransactions = await prisma.bankTransaction.findMany({
    where: {
      bankAccount: { userId: user.id },
      status: { not: "PENDING" },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      bankAccount: true,
    },
  });

  const [loanApplications, activeLoans, recentAuditLogs] = await Promise.all([
    prisma.loanApplication.findMany({
      where: { applicantUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.loan.findMany({
      where: { borrowerUserId: user.id, status: { in: ["ACTIVE", "FROZEN"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    import("@/server/audit.service").then((m) => m.listAuditLogsForTarget("USER", user.id, 15)),
  ]);

  const capabilities: InternalUserManagementCapabilities = {
    tags: buildTagCapabilities(actor, tags),
    ...buildStatusCapabilities(actor),
  };

  return {
    ...mapListRow(user),
    avatarUrl: discordAvatarUrl(user.discordId, user.discordAvatar),
    companyMemberships: user.companyMemberships.map((m) => {
      const role = fromDbCompanyRole(m.role);
      return {
        companyId: m.companyId,
        companyName: m.company.name,
        role,
        roleLabel: COMPANY_ROLE_LABELS[role],
      };
    }),
    bankAccounts: user.bankAccounts.map((a) => ({
      id: a.id,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
      accountTypeLabel: formatBankAccountTypeLabel(fromDbBankAccountType(a.accountType)),
      statusLabel: a.status.charAt(0) + a.status.slice(1).toLowerCase(),
      balance: decimalToNumber(a.balance),
      currency: a.currency,
      isCompanyAccount: a.companyId !== null,
      companyName: a.company?.name ?? null,
    })),
    recentTransactions: recentTransactions.map((tx) => ({
      id: tx.id,
      accountId: tx.bankAccountId,
      accountName: tx.bankAccount.accountName,
      accountNumber: tx.bankAccount.accountNumber,
      type: tx.type.charAt(0) + tx.type.slice(1).toLowerCase(),
      amount: decimalToNumber(tx.amount),
      status: tx.status.charAt(0) + tx.status.slice(1).toLowerCase(),
      description: tx.description,
      createdAt: tx.createdAt.toISOString(),
    })),
    loanApplications: loanApplications.map((app) => ({
      id: app.id,
      productLabel: app.productType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      statusLabel: app.status.charAt(0) + app.status.slice(1).toLowerCase().replace(/_/g, " "),
      requestedAmount: decimalToNumber(app.requestedAmount),
      createdAt: app.createdAt.toISOString(),
    })),
    activeLoans: activeLoans.map((loan) => ({
      id: loan.id,
      productLabel: loan.productType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      statusLabel: loan.status.charAt(0) + loan.status.slice(1).toLowerCase().replace(/_/g, " "),
      principalAmount: decimalToNumber(loan.principalAmount),
      principalOutstanding: decimalToNumber(loan.principalOutstanding),
      currentPayoffAmount: decimalToNumber(loan.outstandingBalance),
      createdAt: loan.createdAt.toISOString(),
    })),
    recentAuditLogs,
    capabilities,
  };
}

export async function grantInternalUserTag(
  actorUserId: string,
  targetUserId: string,
  tag: UserTag,
): Promise<InternalUserDetail> {
  const actorRecord = await prisma.user.findUnique({
    where: { id: actorUserId },
    include: userWithMembershipsInclude,
  });
  if (!actorRecord) forbid();
  const actor = mapDbUserToAltaUser(actorRecord);

  if (!isAdmin(actor) && !isOperator(actor)) forbid();

  assertActorCanModifyTag(actor, tag, "grant");
  assertNotSelfAdminChange(actor, targetUserId, tag);

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) notFound();

  await prisma.userTagAssignment.upsert({
    where: { userId_tag: { userId: targetUserId, tag: toDbUserTag(tag) } },
    create: { userId: targetUserId, tag: toDbUserTag(tag) },
    update: {},
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "USER_TAG_GRANTED",
    entityType: "USER",
    entityId: targetUserId,
    targetUserId,
    description: `Granted ${formatUserTag(tag)} tag`,
    metadata: { tag },
  });

  if (tag === "private_client") {
    await writeAuditLog({
      actorUserId,
      action: "PRIVATE_BANKING_CLIENT_MARKED",
      entityType: "USER",
      entityId: targetUserId,
      targetUserId,
      description: "Alta Private membership activated",
      metadata: { userId: targetUserId, actorUserId, before: false, after: true },
    });

    const { finalizeAltaPrivateMembershipActivation } = await import(
      "@/server/alta-private-timeline.service"
    );
    await finalizeAltaPrivateMembershipActivation(targetUserId, actorUserId);
  }

  return getInternalUserDetail(targetUserId);
}

export async function revokeInternalUserTag(
  actorUserId: string,
  targetUserId: string,
  tag: UserTag,
): Promise<InternalUserDetail> {
  const actorRecord = await prisma.user.findUnique({
    where: { id: actorUserId },
    include: userWithMembershipsInclude,
  });
  if (!actorRecord) forbid();
  const actor = mapDbUserToAltaUser(actorRecord);

  if (!isAdmin(actor) && !isOperator(actor)) forbid();

  assertActorCanModifyTag(actor, tag, "revoke");
  assertNotSelfAdminChange(actor, targetUserId, tag);
  await assertNotLastAdmin(targetUserId, tag);

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) notFound();

  if (tag === "private_client") {
    const { liquidatePrivateBankingOnAccessRevoked } = await import("@/server/bank.service");
    await liquidatePrivateBankingOnAccessRevoked(targetUserId);
  }

  await prisma.userTagAssignment.deleteMany({
    where: { userId: targetUserId, tag: toDbUserTag(tag) },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "USER_TAG_REVOKED",
    entityType: "USER",
    entityId: targetUserId,
    targetUserId,
    description: `Revoked ${formatUserTag(tag)} tag`,
    metadata: { tag },
  });

  if (tag === "private_client") {
    await writeAuditLog({
      actorUserId,
      action: "PRIVATE_BANKING_CLIENT_REMOVED",
      entityType: "USER",
      entityId: targetUserId,
      targetUserId,
      description: "Alta Private membership removed",
      metadata: { userId: targetUserId, actorUserId, before: true, after: false },
    });
  }

  return getInternalUserDetail(targetUserId);
}

export async function updateInternalUserAccountStatus(
  actorUserId: string,
  targetUserId: string,
  accountStatus: AccountStatus,
): Promise<InternalUserDetail> {
  const actorRecord = await prisma.user.findUnique({
    where: { id: actorUserId },
    include: userWithMembershipsInclude,
  });
  if (!actorRecord) forbid();
  const actor = mapDbUserToAltaUser(actorRecord);

  const { allowedAccountStatuses, canChangeAccountStatus } = buildStatusCapabilities(actor);
  if (!canChangeAccountStatus) forbid();

  if (!allowedAccountStatuses.includes(accountStatus)) {
    badRequest("Your role cannot set this account status.");
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) notFound();

  await prisma.user.update({
    where: { id: targetUserId },
    data: { accountStatus: toDbAccountStatus(accountStatus) },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "USER_STATUS_CHANGED",
    entityType: "USER",
    entityId: targetUserId,
    targetUserId,
    description: `Changed account status to ${accountStatus}`,
    metadata: { accountStatus },
  });

  try {
    const { staffAuditUserStatusChanged } = await import("@/server/staff-audit-events");
    staffAuditUserStatusChanged({
      adminId: actorUserId,
      userId: targetUserId,
      accountStatus,
    });
  } catch (error) {
    console.error("[internal-users] staff audit status change failed", error);
  }

  return getInternalUserDetail(targetUserId);
}
