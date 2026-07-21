import { randomBytes } from "node:crypto";
import {
  Prisma,
  type FinancialInstitutionType,
  type NccParticipantApplication,
  type NccParticipantApplicationStatus,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth.service";
import { requireNccStaff } from "@/server/ncc/ncc-permissions.service";
import { allocateRoutingNumberCandidate, slugifyInstitutionName } from "@/lib/ncc/ncc-money";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import {
  applicationFieldsLocked,
  canApplicantTransition,
  canStaffTransition,
  DEFAULT_REQUIRED_DOCUMENTS,
  parseAccountIdentifierFormat,
  type AccountIdentifierFormatProfile,
} from "@/lib/ncc/ncc-participant-application";

export class NccParticipantApplicationError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccParticipantApplicationError";
  }
}

export type ApplicationWritableFields = {
  legalName: string;
  displayName: string;
  institutionType: FinancialInstitutionType;
  countryJurisdiction: string;
  registeredAddress: string;
  websiteUrl?: string | null;
  regulatoryAuthority: string;
  licenseOrRegistrationNumber: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string | null;
  complianceContactName: string;
  complianceContactEmail: string;
  technicalContactName: string;
  technicalContactEmail: string;
  settlementOpsContactName: string;
  settlementOpsContactEmail: string;
  expectedTransactionVolume?: string | null;
  expectedPeakRate?: string | null;
  expectedLiquidityRequirement?: string | null;
  accountIdentifierFormat: AccountIdentifierFormatProfile | Record<string, unknown>;
  intendedConnectionMethod?: string | null;
  applicantNotes?: string | null;
};

function generateApplicationReference(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
  return `NCC-APP-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function requireTrimmed(value: string | null | undefined, field: string, max = 500): string {
  const v = (value ?? "").trim();
  if (!v) throw new NccParticipantApplicationError("VALIDATION_ERROR", `${field} is required.`);
  if (v.length > max) throw new NccParticipantApplicationError("VALIDATION_ERROR", `${field} is too long.`);
  return v;
}

function optionalTrimmed(value: string | null | undefined, max = 2000): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return v.slice(0, max);
}

function normalizeWritable(input: ApplicationWritableFields) {
  let accountIdentifierFormat: AccountIdentifierFormatProfile;
  try {
    accountIdentifierFormat = parseAccountIdentifierFormat(input.accountIdentifierFormat);
  } catch {
    throw new NccParticipantApplicationError("ACCOUNT_FORMAT_REQUIRED", "Account identifier format is required.");
  }
  return {
    legalName: requireTrimmed(input.legalName, "legalName", 200),
    displayName: requireTrimmed(input.displayName, "displayName", 200),
    institutionType: input.institutionType,
    countryJurisdiction: requireTrimmed(input.countryJurisdiction, "countryJurisdiction", 120),
    registeredAddress: requireTrimmed(input.registeredAddress, "registeredAddress", 500),
    websiteUrl: optionalTrimmed(input.websiteUrl, 300),
    regulatoryAuthority: requireTrimmed(input.regulatoryAuthority, "regulatoryAuthority", 200),
    licenseOrRegistrationNumber: requireTrimmed(
      input.licenseOrRegistrationNumber,
      "licenseOrRegistrationNumber",
      120,
    ),
    primaryContactName: requireTrimmed(input.primaryContactName, "primaryContactName", 120),
    primaryContactEmail: requireTrimmed(input.primaryContactEmail, "primaryContactEmail", 200),
    primaryContactPhone: optionalTrimmed(input.primaryContactPhone, 40),
    complianceContactName: requireTrimmed(input.complianceContactName, "complianceContactName", 120),
    complianceContactEmail: requireTrimmed(input.complianceContactEmail, "complianceContactEmail", 200),
    technicalContactName: requireTrimmed(input.technicalContactName, "technicalContactName", 120),
    technicalContactEmail: requireTrimmed(input.technicalContactEmail, "technicalContactEmail", 200),
    settlementOpsContactName: requireTrimmed(input.settlementOpsContactName, "settlementOpsContactName", 120),
    settlementOpsContactEmail: requireTrimmed(
      input.settlementOpsContactEmail,
      "settlementOpsContactEmail",
      200,
    ),
    expectedTransactionVolume: optionalTrimmed(input.expectedTransactionVolume, 200),
    expectedPeakRate: optionalTrimmed(input.expectedPeakRate, 200),
    expectedLiquidityRequirement: optionalTrimmed(input.expectedLiquidityRequirement, 200),
    accountIdentifierFormat: accountIdentifierFormat as unknown as Prisma.InputJsonValue,
    intendedConnectionMethod: optionalTrimmed(input.intendedConnectionMethod, 200),
    applicantNotes: optionalTrimmed(input.applicantNotes, 4000),
  };
}

async function writeAppAudit(input: {
  actorUserId: string;
  action: string;
  entityId: string;
  description: string;
  institutionId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "NCC_PARTICIPANT_APPLICATION",
    entityId: input.entityId,
    description: input.description,
    institutionId: input.institutionId ?? undefined,
    metadata: input.metadata,
  });
}

async function recordTransition(input: {
  applicationId: string;
  fromStatus: NccParticipantApplicationStatus;
  toStatus: NccParticipantApplicationStatus;
  actorUserId: string;
  reason?: string | null;
}) {
  await prisma.nccParticipantApplicationTransition.create({
    data: {
      applicationId: input.applicationId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId,
      reason: input.reason?.trim() || null,
    },
  });
}

export type ApplicantApplicationView = {
  id: string;
  publicReference: string;
  status: NccParticipantApplicationStatus;
  legalName: string;
  displayName: string;
  institutionType: FinancialInstitutionType;
  countryJurisdiction: string;
  registeredAddress: string;
  websiteUrl: string | null;
  regulatoryAuthority: string;
  licenseOrRegistrationNumber: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string | null;
  complianceContactName: string;
  complianceContactEmail: string;
  technicalContactName: string;
  technicalContactEmail: string;
  settlementOpsContactName: string;
  settlementOpsContactEmail: string;
  expectedTransactionVolume: string | null;
  expectedPeakRate: string | null;
  expectedLiquidityRequirement: string | null;
  accountIdentifierFormat: AccountIdentifierFormatProfile;
  intendedConnectionMethod: string | null;
  applicantNotes: string | null;
  requiredDocuments: string[];
  informationRequestNote: string | null;
  applicantResponseNote: string | null;
  rejectionReason: string | null;
  institutionId: string | null;
  fieldsLocked: boolean;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  transitions: Array<{
    fromStatus: NccParticipantApplicationStatus;
    toStatus: NccParticipantApplicationStatus;
    reason: string | null;
    createdAt: string;
  }>;
  /** Institution is ready for the owner to create TEST credentials in Developers. */
  testAccessReady: boolean;
};

function mapApplicantView(
  row: NccParticipantApplication & {
    transitions?: Array<{
      fromStatus: NccParticipantApplicationStatus;
      toStatus: NccParticipantApplicationStatus;
      reason: string | null;
      createdAt: Date;
    }>;
  },
): ApplicantApplicationView {
  const docs = Array.isArray(row.requiredDocuments)
    ? (row.requiredDocuments as string[])
    : [...DEFAULT_REQUIRED_DOCUMENTS];
  const testAccessReady =
    !!row.institutionId &&
    !!row.provisionedAt &&
    (row.status === "APPROVED_FOR_TEST" ||
      row.status === "CERTIFICATION" ||
      row.status === "APPROVED_FOR_LIVE");
  return {
    id: row.id,
    publicReference: row.publicReference,
    status: row.status,
    legalName: row.legalName,
    displayName: row.displayName,
    institutionType: row.institutionType,
    countryJurisdiction: row.countryJurisdiction,
    registeredAddress: row.registeredAddress,
    websiteUrl: row.websiteUrl,
    regulatoryAuthority: row.regulatoryAuthority,
    licenseOrRegistrationNumber: row.licenseOrRegistrationNumber,
    primaryContactName: row.primaryContactName,
    primaryContactEmail: row.primaryContactEmail,
    primaryContactPhone: row.primaryContactPhone,
    complianceContactName: row.complianceContactName,
    complianceContactEmail: row.complianceContactEmail,
    technicalContactName: row.technicalContactName,
    technicalContactEmail: row.technicalContactEmail,
    settlementOpsContactName: row.settlementOpsContactName,
    settlementOpsContactEmail: row.settlementOpsContactEmail,
    expectedTransactionVolume: row.expectedTransactionVolume,
    expectedPeakRate: row.expectedPeakRate,
    expectedLiquidityRequirement: row.expectedLiquidityRequirement,
    accountIdentifierFormat: row.accountIdentifierFormat as AccountIdentifierFormatProfile,
    intendedConnectionMethod: row.intendedConnectionMethod,
    applicantNotes: row.applicantNotes,
    requiredDocuments: docs,
    informationRequestNote: row.informationRequestNote,
    applicantResponseNote: row.applicantResponseNote,
    rejectionReason: row.rejectionReason,
    institutionId: row.institutionId,
    fieldsLocked: applicationFieldsLocked(row.status),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    transitions: (row.transitions ?? []).map((t) => ({
      fromStatus: t.fromStatus,
      toStatus: t.toStatus,
      reason: t.reason,
      createdAt: t.createdAt.toISOString(),
    })),
    testAccessReady,
  };
}

async function getOwnedApplication(userId: string, id: string) {
  const row = await prisma.nccParticipantApplication.findUnique({
    where: { id },
    include: { transitions: { orderBy: { createdAt: "asc" } } },
  });
  if (!row || row.applicantUserId !== userId) {
    throw new NccParticipantApplicationError("NOT_FOUND", "Application not found.");
  }
  return row;
}

export async function createDraftApplication(
  input: ApplicationWritableFields,
): Promise<ApplicantApplicationView> {
  const user = await requireAuth();
  const data = normalizeWritable(input);
  const row = await prisma.nccParticipantApplication.create({
    data: {
      ...data,
      publicReference: generateApplicationReference(),
      status: "DRAFT",
      applicantUserId: user.id,
      requiredDocuments: [...DEFAULT_REQUIRED_DOCUMENTS],
    },
    include: { transitions: true },
  });
  await writeAppAudit({
    actorUserId: user.id,
    action: "NCC_PARTICIPANT_APPLICATION_CREATED",
    entityId: row.id,
    description: `Participant application draft ${row.publicReference} created`,
  });
  return mapApplicantView(row);
}

export async function saveDraftApplication(
  id: string,
  input: ApplicationWritableFields,
): Promise<ApplicantApplicationView> {
  const user = await requireAuth();
  const existing = await getOwnedApplication(user.id, id);
  if (applicationFieldsLocked(existing.status) && existing.status !== "INFORMATION_REQUIRED") {
    throw new NccParticipantApplicationError("FIELDS_LOCKED", "Application fields are locked.");
  }
  const data = normalizeWritable(input);
  const row = await prisma.nccParticipantApplication.update({
    where: { id },
    data:
      existing.status === "INFORMATION_REQUIRED"
        ? { ...data, applicantResponseNote: data.applicantNotes }
        : data,
    include: { transitions: { orderBy: { createdAt: "asc" } } },
  });
  return mapApplicantView(row);
}

export async function submitApplication(id: string): Promise<ApplicantApplicationView> {
  const user = await requireAuth();
  const existing = await getOwnedApplication(user.id, id);
  if (!canApplicantTransition(existing.status, "SUBMITTED")) {
    throw new NccParticipantApplicationError("INVALID_TRANSITION", "Cannot submit in current status.");
  }
  normalizeWritable({
    ...existing,
    accountIdentifierFormat: existing.accountIdentifierFormat as AccountIdentifierFormatProfile,
  });
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.nccParticipantApplication.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
      include: { transitions: { orderBy: { createdAt: "asc" } } },
    });
    await tx.nccParticipantApplicationTransition.create({
      data: {
        applicationId: id,
        fromStatus: existing.status,
        toStatus: "SUBMITTED",
        actorUserId: user.id,
        reason: "Applicant submitted application",
      },
    });
    return updated;
  });
  await writeAppAudit({
    actorUserId: user.id,
    action: "NCC_PARTICIPANT_APPLICATION_SUBMITTED",
    entityId: id,
    description: `Participant application ${row.publicReference} submitted`,
  });
  return mapApplicantView(await getOwnedApplication(user.id, id));
}

export async function respondToInformationRequest(
  id: string,
  responseNote: string,
  fields?: ApplicationWritableFields,
): Promise<ApplicantApplicationView> {
  const user = await requireAuth();
  const existing = await getOwnedApplication(user.id, id);
  if (existing.status !== "INFORMATION_REQUIRED") {
    throw new NccParticipantApplicationError("INVALID_TRANSITION", "No information request is open.");
  }
  if (!canApplicantTransition(existing.status, "UNDER_REVIEW")) {
    throw new NccParticipantApplicationError("INVALID_TRANSITION", "Cannot respond in current status.");
  }
  const note = requireTrimmed(responseNote, "responseNote", 4000);
  const data = fields ? normalizeWritable(fields) : null;
  await prisma.$transaction(async (tx) => {
    await tx.nccParticipantApplication.update({
      where: { id },
      data: {
        ...(data ?? {}),
        applicantResponseNote: note,
        status: "UNDER_REVIEW",
        informationRequestNote: existing.informationRequestNote,
      },
    });
    await tx.nccParticipantApplicationTransition.create({
      data: {
        applicationId: id,
        fromStatus: "INFORMATION_REQUIRED",
        toStatus: "UNDER_REVIEW",
        actorUserId: user.id,
        reason: note.slice(0, 500),
      },
    });
  });
  await writeAppAudit({
    actorUserId: user.id,
    action: "NCC_PARTICIPANT_APPLICATION_INFO_RESPONSE",
    entityId: id,
    description: `Applicant responded to information request on ${existing.publicReference}`,
  });
  return mapApplicantView(await getOwnedApplication(user.id, id));
}

export async function withdrawApplication(id: string, reason?: string): Promise<ApplicantApplicationView> {
  const user = await requireAuth();
  const existing = await getOwnedApplication(user.id, id);
  if (!canApplicantTransition(existing.status, "WITHDRAWN")) {
    throw new NccParticipantApplicationError("INVALID_TRANSITION", "Cannot withdraw in current status.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.nccParticipantApplication.update({
      where: { id },
      data: { status: "WITHDRAWN", withdrawnAt: new Date() },
    });
    await tx.nccParticipantApplicationTransition.create({
      data: {
        applicationId: id,
        fromStatus: existing.status,
        toStatus: "WITHDRAWN",
        actorUserId: user.id,
        reason: reason?.trim() || "Withdrawn by applicant",
      },
    });
  });
  await writeAppAudit({
    actorUserId: user.id,
    action: "NCC_PARTICIPANT_APPLICATION_WITHDRAWN",
    entityId: id,
    description: `Participant application ${existing.publicReference} withdrawn`,
  });
  return mapApplicantView(await getOwnedApplication(user.id, id));
}

export async function listApplicantApplications(): Promise<ApplicantApplicationView[]> {
  const user = await requireAuth();
  const rows = await prisma.nccParticipantApplication.findMany({
    where: { applicantUserId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { transitions: { orderBy: { createdAt: "asc" } } },
  });
  return rows.map((r) => mapApplicantView(r));
}

export async function getApplicantApplication(id: string): Promise<ApplicantApplicationView> {
  const user = await requireAuth();
  return mapApplicantView(await getOwnedApplication(user.id, id));
}

export type StaffApplicationView = ApplicantApplicationView & {
  applicantUserId: string;
  internalNotes: Array<{ id: string; body: string; authorUserId: string; createdAt: string }>;
  testCredentialId: string | null;
  provisionedAt: string | null;
};

async function getStaffApplication(id: string) {
  const row = await prisma.nccParticipantApplication.findUnique({
    where: { id },
    include: {
      transitions: { orderBy: { createdAt: "asc" } },
      internalNotes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!row) throw new NccParticipantApplicationError("NOT_FOUND", "Application not found.");
  return row;
}

function mapStaffView(row: Awaited<ReturnType<typeof getStaffApplication>>): StaffApplicationView {
  const base = mapApplicantView(row);
  return {
    ...base,
    applicantUserId: row.applicantUserId,
    testCredentialId: row.testCredentialId,
    provisionedAt: row.provisionedAt?.toISOString() ?? null,
    internalNotes: row.internalNotes.map((n) => ({
      id: n.id,
      body: n.body,
      authorUserId: n.authorUserId,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function listStaffApplications(filters?: {
  status?: NccParticipantApplicationStatus;
}): Promise<StaffApplicationView[]> {
  await requireNccStaff();
  const rows = await prisma.nccParticipantApplication.findMany({
    where: {
      status: filters?.status ?? { not: "DRAFT" },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      transitions: { orderBy: { createdAt: "asc" } },
      internalNotes: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  return rows.map((r) => mapStaffView(r));
}

export async function getStaffApplicationDetail(id: string): Promise<StaffApplicationView> {
  await requireNccStaff();
  return mapStaffView(await getStaffApplication(id));
}

export async function addStaffInternalNote(id: string, body: string): Promise<StaffApplicationView> {
  const staff = await requireNccStaff();
  const note = requireTrimmed(body, "body", 4000);
  await getStaffApplication(id);
  await prisma.nccParticipantApplicationNote.create({
    data: { applicationId: id, authorUserId: staff.id, body: note },
  });
  await writeAppAudit({
    actorUserId: staff.id,
    action: "NCC_PARTICIPANT_APPLICATION_NOTE_ADDED",
    entityId: id,
    description: "Internal note added to participant application",
  });
  return mapStaffView(await getStaffApplication(id));
}

/**
 * Idempotent / resumable TEST provisioning:
 * institution (CERTIFICATION) + owner membership + reserved routing number.
 * Does NOT issue API credentials — the institution owner creates TEST credentials
 * in the developer portal (secret shown once to the owner only).
 */
export async function provisionApplicationForTest(applicationId: string, actorUserId: string) {
  const existing = await prisma.nccParticipantApplication.findUniqueOrThrow({
    where: { id: applicationId },
  });

  const format = existing.accountIdentifierFormat as AccountIdentifierFormatProfile;
  let institutionId = existing.institutionId;
  let createdInstitution = false;

  if (!institutionId) {
    const baseSlug = slugifyInstitutionName(existing.displayName || existing.legalName);
    let slug = baseSlug;
    for (let i = 0; i < 8; i++) {
      const clash = await prisma.financialInstitution.findUnique({ where: { slug } });
      if (!clash) break;
      slug = `${baseSlug}-${randomBytes(2).toString("hex")}`;
    }
    const institution = await prisma.financialInstitution.create({
      data: {
        legalName: existing.legalName,
        displayName: existing.displayName,
        slug,
        institutionType: existing.institutionType,
        status: "CERTIFICATION",
        websiteUrl: existing.websiteUrl,
        primaryContactUserId: existing.applicantUserId,
        isAlta: false,
        isNCCParticipant: false,
        metadata: {
          accountIdentifierFormat: format,
          sourceApplicationId: existing.id,
          sourceApplicationReference: existing.publicReference,
        },
      },
    });
    institutionId = institution.id;
    createdInstitution = true;
  } else {
    await prisma.financialInstitution.update({
      where: { id: institutionId },
      data: {
        status: "CERTIFICATION",
        isNCCParticipant: false,
        metadata: {
          accountIdentifierFormat: format,
          sourceApplicationId: existing.id,
          sourceApplicationReference: existing.publicReference,
        },
      },
    });
  }

  const owner = await prisma.institutionMember.findUnique({
    where: {
      institutionId_userId: { institutionId, userId: existing.applicantUserId },
    },
  });
  if (!owner) {
    await prisma.institutionMember.create({
      data: {
        institutionId,
        userId: existing.applicantUserId,
        role: "INSTITUTION_OWNER",
        status: "ACTIVE",
        invitedByUserId: actorUserId,
      },
    });
  } else if (owner.role !== "INSTITUTION_OWNER" || owner.status !== "ACTIVE") {
    await prisma.institutionMember.update({
      where: { id: owner.id },
      data: { role: "INSTITUTION_OWNER", status: "ACTIVE", revokedAt: null },
    });
  }

  const reserved = await prisma.routingNumber.findFirst({
    where: { institutionId, status: "RESERVED" },
  });
  if (!reserved) {
    const count = await prisma.routingNumber.count();
    let candidate = allocateRoutingNumberCandidate("880", count + 1);
    for (let attempt = 0; attempt < 12; attempt++) {
      const taken = await prisma.routingNumber.findUnique({ where: { routingNumber: candidate } });
      if (!taken) break;
      candidate = allocateRoutingNumberCandidate("880", count + attempt + 2);
    }
    await prisma.routingNumber.create({
      data: {
        institutionId,
        routingNumber: candidate,
        status: "RESERVED",
        isPrimary: true,
        label: "Reserved pending LIVE activation",
        activatedAt: null,
      },
    });
  }

  // Never seed settlement balances / settlement accounts here.
  // Never create API credentials here — owner creates TEST credentials themselves.

  const alreadyComplete = !!existing.institutionId && !!existing.provisionedAt && !createdInstitution;

  await prisma.nccParticipantApplication.update({
    where: { id: applicationId },
    data: {
      institutionId,
      provisionedAt: existing.provisionedAt ?? new Date(),
      // Clear any legacy staff-issued credential pointer; owner manages credentials.
      testCredentialId: null,
    },
  });

  if (createdInstitution) {
    await writeAppAudit({
      actorUserId: actorUserId,
      action: NCC_AUDIT.INSTITUTION_CREATED,
      entityId: institutionId,
      description: `Institution provisioned for TEST from application ${existing.publicReference}`,
      institutionId,
      metadata: { applicationId },
    });
  }

  return {
    institutionId,
    credentialId: null as string | null,
    secretOnce: null as null,
    reused: alreadyComplete,
  };
}

export async function staffTransitionApplication(input: {
  id: string;
  toStatus: NccParticipantApplicationStatus;
  reason?: string;
  informationRequestNote?: string;
}): Promise<StaffApplicationView> {
  const staff = await requireNccStaff();
  const existing = await getStaffApplication(input.id);
  if (!canStaffTransition(existing.status, input.toStatus)) {
    throw new NccParticipantApplicationError(
      "INVALID_TRANSITION",
      `Cannot transition from ${existing.status} to ${input.toStatus}.`,
    );
  }
  if (input.toStatus === "REJECTED" && !input.reason?.trim()) {
    throw new NccParticipantApplicationError("REASON_REQUIRED", "Rejection reason is required.");
  }
  if (input.toStatus === "INFORMATION_REQUIRED" && !input.informationRequestNote?.trim()) {
    throw new NccParticipantApplicationError(
      "REASON_REQUIRED",
      "Information request note is required.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.nccParticipantApplication.update({
      where: { id: input.id },
      data: {
        status: input.toStatus,
        rejectionReason:
          input.toStatus === "REJECTED" ? input.reason!.trim() : existing.rejectionReason,
        informationRequestNote:
          input.toStatus === "INFORMATION_REQUIRED"
            ? input.informationRequestNote!.trim()
            : existing.informationRequestNote,
      },
    });
    await tx.nccParticipantApplicationTransition.create({
      data: {
        applicationId: input.id,
        fromStatus: existing.status,
        toStatus: input.toStatus,
        actorUserId: staff.id,
        reason:
          input.reason?.trim() ||
          input.informationRequestNote?.trim() ||
          `Staff transition to ${input.toStatus}`,
      },
    });
  });

  if (input.toStatus === "APPROVED_FOR_TEST") {
    // Provision institution/membership/routing only — never return secrets to staff.
    await provisionApplicationForTest(input.id, staff.id);
  }

  await writeAppAudit({
    actorUserId: staff.id,
    action: "NCC_PARTICIPANT_APPLICATION_TRANSITION",
    entityId: input.id,
    description: `Application ${existing.publicReference}: ${existing.status} → ${input.toStatus}`,
    institutionId: existing.institutionId,
    metadata: { from: existing.status, to: input.toStatus },
  });

  return mapStaffView(await getStaffApplication(input.id));
}

/** Guard used by credential creation — CERTIFICATION institutions may only receive TEST. */
export async function assertCredentialEnvironmentAllowed(
  institutionId: string,
  environment: "TEST" | "LIVE",
): Promise<void> {
  const institution = await prisma.financialInstitution.findUniqueOrThrow({
    where: { id: institutionId },
  });
  if (environment === "LIVE") {
    if (institution.status !== "ACTIVE" || !institution.isNCCParticipant) {
      throw new NccParticipantApplicationError(
        "LIVE_CREDENTIAL_DENIED",
        "LIVE credentials require an ACTIVE NCC participant institution.",
      );
    }
    return;
  }
  if (
    institution.status !== "CERTIFICATION" &&
    institution.status !== "ACTIVE" &&
    institution.status !== "RESTRICTED"
  ) {
    throw new NccParticipantApplicationError(
      "TEST_CREDENTIAL_DENIED",
      "Institution is not eligible for TEST credentials.",
    );
  }
}
