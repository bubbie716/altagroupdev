import { prisma } from "@/server/db";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import {
  maskDirectoryIdentifier,
  parseDirectoryCsv,
  validateDirectoryRows,
  type DirectoryCsvRow,
} from "@/lib/ncc/ncc-directory";
import { requireInstitutionPermission } from "@/server/ncc/ncc-permissions.service";

export class NccDirectoryError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccDirectoryError";
  }
}

export type DirectoryVersionView = {
  id: string;
  versionNumber: number;
  status: string;
  currency: string;
  fileName: string | null;
  rowCounts: Record<string, number> | null;
  activatedAt: string | null;
  createdAt: string;
  entryCount: number;
};

function mapVersion(
  row: {
    id: string;
    versionNumber: number;
    status: string;
    currency: string;
    fileName: string | null;
    rowCounts: unknown;
    activatedAt: Date | null;
    createdAt: Date;
    _count?: { entries: number };
  },
): DirectoryVersionView {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    status: row.status,
    currency: row.currency,
    fileName: row.fileName,
    rowCounts: (row.rowCounts as Record<string, number> | null) ?? null,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    entryCount: row._count?.entries ?? 0,
  };
}

export async function listDirectoryVersions(institutionId: string, currency = NCC_DEFAULT_CURRENCY) {
  await requireInstitutionPermission(institutionId, "manage_api_credentials");
  const rows = await prisma.nccAccountDirectoryVersion.findMany({
    where: { institutionId, currency: currency.toUpperCase() },
    orderBy: { versionNumber: "desc" },
    include: { _count: { select: { entries: true } } },
  });
  return rows.map(mapVersion);
}

export async function uploadDirectoryCsvAsActor(
  actorUserId: string,
  input: {
    institutionId: string;
    csvText: string;
    fileName?: string;
    currency?: string;
  },
): Promise<{
  version: DirectoryVersionView;
  validation: ReturnType<typeof validateDirectoryRows>;
  diff: { added: number; changed: number; closed: number; unchanged: number; rejected: number };
}> {
  const currency = (input.currency ?? NCC_DEFAULT_CURRENCY).toUpperCase();
  const { headers, rows } = parseDirectoryCsv(input.csvText);
  const validation = validateDirectoryRows(headers, rows, currency);
  if (validation.validRows.length === 0) {
    throw new NccDirectoryError("DIRECTORY_VALIDATION_FAILED", "No valid rows to import.");
  }

  const active = await prisma.nccAccountDirectoryVersion.findFirst({
    where: { institutionId: input.institutionId, currency, status: "ACTIVE" },
    include: { entries: true },
  });
  const activeMap = new Map(
    (active?.entries ?? []).map((e) => [e.accountIdentifier, e] as const),
  );

  let added = 0;
  let changed = 0;
  let closed = 0;
  let unchanged = 0;
  for (const row of validation.validRows) {
    const prev = activeMap.get(row.accountIdentifier);
    if (!prev) {
      added++;
      continue;
    }
    if (
      prev.participantAccountReference === row.participantAccountReference &&
      prev.status === row.status &&
      prev.canDebit === row.canDebit &&
      prev.canCredit === row.canCredit
    ) {
      unchanged++;
    } else if (row.status === "CLOSED" && prev.status !== "CLOSED") {
      closed++;
    } else {
      changed++;
    }
  }

  const latest = await prisma.nccAccountDirectoryVersion.findFirst({
    where: { institutionId: input.institutionId, currency },
    orderBy: { versionNumber: "desc" },
  });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;

  const created = await prisma.$transaction(async (tx) => {
    const version = await tx.nccAccountDirectoryVersion.create({
      data: {
        institutionId: input.institutionId,
        currency,
        versionNumber,
        status: "VALIDATED",
        fileName: input.fileName?.slice(0, 200) ?? null,
        uploadedByUserId: actorUserId,
        rowCounts: {
          added,
          changed,
          closed,
          unchanged,
          rejected: validation.counts.rejected,
          valid: validation.counts.valid,
          total: validation.counts.total,
        },
      },
    });
    if (validation.validRows.length > 0) {
      await tx.nccAccountDirectoryEntry.createMany({
        data: validation.validRows.map((row) => ({
          versionId: version.id,
          institutionId: input.institutionId,
          accountIdentifier: row.accountIdentifier,
          participantAccountReference: row.participantAccountReference,
          currency: row.currency,
          status: row.status,
          canDebit: row.canDebit,
          canCredit: row.canCredit,
          beneficiaryLabel: row.beneficiaryLabel ?? null,
        })),
      });
    }
    return version;
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: NCC_AUDIT.DIRECTORY_UPLOADED,
    entityType: "FINANCIAL_INSTITUTION",
    entityId: input.institutionId,
    institutionId: input.institutionId,
    description: `Account directory v${versionNumber} uploaded (${validation.counts.valid} valid rows)`,
    metadata: {
      versionId: created.id,
      added,
      changed,
      closed,
      unchanged,
      rejected: validation.counts.rejected,
    },
  });

  const withCount = await prisma.nccAccountDirectoryVersion.findUniqueOrThrow({
    where: { id: created.id },
    include: { _count: { select: { entries: true } } },
  });

  return {
    version: mapVersion(withCount),
    validation: {
      ...validation,
      validRows: [] as DirectoryCsvRow[],
      duplicates: validation.duplicates.map(maskDirectoryIdentifier),
    },
    diff: {
      added,
      changed,
      closed,
      unchanged,
      rejected: validation.counts.rejected,
    },
  };
}

export async function uploadDirectoryCsv(input: {
  institutionId: string;
  csvText: string;
  fileName?: string;
  currency?: string;
}): Promise<{
  version: DirectoryVersionView;
  validation: ReturnType<typeof validateDirectoryRows>;
  diff: { added: number; changed: number; closed: number; unchanged: number; rejected: number };
}> {
  const { user } = await requireInstitutionPermission(input.institutionId, "manage_api_credentials");
  return uploadDirectoryCsvAsActor(user.id, input);
}

export async function activateDirectoryVersionAsActor(
  actorUserId: string,
  input: { institutionId: string; versionId: string },
): Promise<DirectoryVersionView> {
  const version = await prisma.nccAccountDirectoryVersion.findFirst({
    where: { id: input.versionId, institutionId: input.institutionId },
  });
  if (!version) throw new NccDirectoryError("NOT_FOUND", "Directory version not found.");
  if (version.status !== "VALIDATED" && version.status !== "ROLLED_BACK" && version.status !== "SUPERSEDED") {
    if (version.status === "ACTIVE") {
      const current = await prisma.nccAccountDirectoryVersion.findUniqueOrThrow({
        where: { id: version.id },
        include: { _count: { select: { entries: true } } },
      });
      return mapVersion(current);
    }
    throw new NccDirectoryError("INVALID_STATUS", "Version cannot be activated.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.nccAccountDirectoryVersion.updateMany({
      where: {
        institutionId: input.institutionId,
        currency: version.currency,
        status: "ACTIVE",
      },
      data: { status: "SUPERSEDED" },
    });
    await tx.nccAccountDirectoryVersion.update({
      where: { id: version.id },
      data: {
        status: "ACTIVE",
        activatedAt: new Date(),
        activatedByUserId: actorUserId,
      },
    });
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: NCC_AUDIT.DIRECTORY_ACTIVATED,
    entityType: "FINANCIAL_INSTITUTION",
    entityId: input.institutionId,
    institutionId: input.institutionId,
    description: `Account directory v${version.versionNumber} activated`,
    metadata: { versionId: version.id },
  });

  const next = await prisma.nccAccountDirectoryVersion.findUniqueOrThrow({
    where: { id: version.id },
    include: { _count: { select: { entries: true } } },
  });
  return mapVersion(next);
}

export async function activateDirectoryVersion(input: {
  institutionId: string;
  versionId: string;
}): Promise<DirectoryVersionView> {
  const { user } = await requireInstitutionPermission(input.institutionId, "manage_api_credentials");
  return activateDirectoryVersionAsActor(user.id, input);
}

export async function rollbackDirectoryVersionAsActor(
  actorUserId: string,
  input: { institutionId: string; currency?: string },
): Promise<DirectoryVersionView | null> {
  const currency = (input.currency ?? NCC_DEFAULT_CURRENCY).toUpperCase();
  const active = await prisma.nccAccountDirectoryVersion.findFirst({
    where: { institutionId: input.institutionId, currency, status: "ACTIVE" },
  });
  if (!active) throw new NccDirectoryError("NO_ACTIVE_DIRECTORY", "No active directory version.");

  const previous = await prisma.nccAccountDirectoryVersion.findFirst({
    where: {
      institutionId: input.institutionId,
      currency,
      versionNumber: { lt: active.versionNumber },
      status: { in: ["SUPERSEDED", "ROLLED_BACK", "VALIDATED"] },
    },
    orderBy: { versionNumber: "desc" },
  });
  if (!previous) throw new NccDirectoryError("NO_PREVIOUS_VERSION", "No previous version to restore.");

  await prisma.$transaction(async (tx) => {
    await tx.nccAccountDirectoryVersion.update({
      where: { id: active.id },
      data: { status: "ROLLED_BACK" },
    });
    await tx.nccAccountDirectoryVersion.update({
      where: { id: previous.id },
      data: {
        status: "ACTIVE",
        activatedAt: new Date(),
        activatedByUserId: actorUserId,
      },
    });
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: NCC_AUDIT.DIRECTORY_ROLLED_BACK,
    entityType: "FINANCIAL_INSTITUTION",
    entityId: input.institutionId,
    institutionId: input.institutionId,
    description: `Account directory rolled back to v${previous.versionNumber}`,
    metadata: { fromVersionId: active.id, toVersionId: previous.id },
  });

  const next = await prisma.nccAccountDirectoryVersion.findUniqueOrThrow({
    where: { id: previous.id },
    include: { _count: { select: { entries: true } } },
  });
  return mapVersion(next);
}

export async function rollbackDirectoryVersion(input: {
  institutionId: string;
  currency?: string;
}): Promise<DirectoryVersionView | null> {
  const { user } = await requireInstitutionPermission(input.institutionId, "manage_api_credentials");
  return rollbackDirectoryVersionAsActor(user.id, input);
}

/** Internal resolution helper used by external adapter — not a public API. */
export async function resolveFromActiveDirectory(input: {
  institutionId: string;
  accountIdentifier: string;
  currency: string;
  direction: "debit" | "credit";
}): Promise<
  | {
      ok: true;
      participantAccountReference: string;
      canonicalIdentifier: string;
      maskedIdentifier: string;
      canDebit: boolean;
      canCredit: boolean;
      status: string;
      beneficiaryLabel: string | null;
    }
  | { ok: false; code: string }
> {
  const currency = input.currency.toUpperCase();
  const active = await prisma.nccAccountDirectoryVersion.findFirst({
    where: { institutionId: input.institutionId, currency, status: "ACTIVE" },
  });
  if (!active) return { ok: false, code: "DIRECTORY_NOT_ACTIVE" };

  const entry = await prisma.nccAccountDirectoryEntry.findUnique({
    where: {
      versionId_accountIdentifier: {
        versionId: active.id,
        accountIdentifier: input.accountIdentifier,
      },
    },
  });
  if (!entry || entry.status !== "ACTIVE") return { ok: false, code: "ACCOUNT_UNAVAILABLE" };
  if (entry.currency !== currency) return { ok: false, code: "UNSUPPORTED_CURRENCY" };
  if (input.direction === "debit" && !entry.canDebit) return { ok: false, code: "ACCOUNT_NOT_DEBITABLE" };
  if (input.direction === "credit" && !entry.canCredit) {
    return { ok: false, code: "ACCOUNT_NOT_CREDITABLE" };
  }

  return {
    ok: true,
    participantAccountReference: entry.participantAccountReference,
    canonicalIdentifier: entry.accountIdentifier,
    maskedIdentifier: maskDirectoryIdentifier(entry.accountIdentifier),
    canDebit: entry.canDebit,
    canCredit: entry.canCredit,
    status: entry.status,
    beneficiaryLabel: entry.beneficiaryLabel,
  };
}
