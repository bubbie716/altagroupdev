import { NCC_STEP_UP_MFA_AVAILABLE } from "@/lib/ncc/ncc-staff-permissions";
import { isDatabaseConfigured, prisma } from "@/server/db";
import { countUnexplainedLegacyFloats } from "@/server/ncc/ncc-institution.service";
import {
  ensureNccOutboxHandlersRegistered,
  listExpectedOutboxEventTypes,
  NCC_WORKER_OVERDUE_MS,
} from "@/server/ncc/ncc-workers.service";
import { listRegisteredOutboxEventTypes } from "@/server/ncc/ncc-outbox.service";
import { countExpiredRegulatoryDocuments } from "@/server/ncc/ncc-participant-documents.service";
import { requireNccStaff } from "@/server/ncc/ncc-permissions.service";

export type NccReadinessFinding = {
  code: string;
  message: string;
  severity: "blocker" | "warning";
};

export type NccProductionReadiness = {
  ready: boolean;
  checkedAt: string;
  blockers: NccReadinessFinding[];
  warnings: NccReadinessFinding[];
  /** Booleans only — never secret values. */
  signals: Record<string, boolean | string | number | null>;
};

function hasMinSecret(value: string | undefined, minLen: number): boolean {
  return Boolean(value?.trim() && value.trim().length >= minLen);
}

/**
 * Production readiness report — blockers without exposing secret values.
 * Build success alone must never imply ready.
 */
export async function getNccProductionReadiness(): Promise<NccProductionReadiness> {
  await requireNccStaff("view_readiness");

  const blockers: NccReadinessFinding[] = [];
  const warnings: NccReadinessFinding[] = [];
  const isProd = process.env.NODE_ENV === "production";

  const dbOk = isDatabaseConfigured();
  if (!dbOk) {
    blockers.push({ code: "DATABASE_NOT_CONFIGURED", message: "Database is not configured.", severity: "blocker" });
  }

  const sessionOk = hasMinSecret(process.env.SESSION_SECRET, 16);
  if (!sessionOk) {
    blockers.push({
      code: "SESSION_SECRET_MISSING",
      message: "SESSION_SECRET is missing or too short.",
      severity: "blocker",
    });
  }

  const nccSecretsOk = hasMinSecret(process.env.NCC_SECRETS_KEY, 32);
  if (!nccSecretsOk) {
    blockers.push({
      code: "NCC_SECRETS_KEY_MISSING",
      message: "NCC_SECRETS_KEY is missing or shorter than 32 characters.",
      severity: "blocker",
    });
  }

  const cronOk = hasMinSecret(process.env.CRON_SECRET, 16);
  if (!cronOk) {
    blockers.push({
      code: "CRON_SECRET_MISSING",
      message: "CRON_SECRET is missing or too short.",
      severity: "blocker",
    });
  }

  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  if (isProd && !blobConfigured) {
    blockers.push({
      code: "PRIVATE_DOCUMENT_STORAGE_MISSING",
      message: "Persistent private document storage (BLOB_READ_WRITE_TOKEN) is required in production.",
      severity: "blocker",
    });
  } else if (!blobConfigured) {
    warnings.push({
      code: "PRIVATE_DOCUMENT_STORAGE_MEMORY_FALLBACK",
      message: "Document storage falls back to in-memory outside production.",
      severity: "warning",
    });
  }

  if (!NCC_STEP_UP_MFA_AVAILABLE) {
    blockers.push({
      code: "STEP_UP_MFA_UNAVAILABLE",
      message:
        "Step-up / MFA cannot be proven by the current identity system. Do not treat sensitive NCC actions as MFA-protected.",
      severity: "blocker",
    });
  }

  ensureNccOutboxHandlersRegistered();
  const expected = listExpectedOutboxEventTypes();
  const registered = new Set(listRegisteredOutboxEventTypes());
  const missingHandlers = expected.filter((t) => !registered.has(t));
  if (missingHandlers.length > 0) {
    blockers.push({
      code: "MISSING_OUTBOX_HANDLERS",
      message: `Missing outbox handlers: ${missingHandlers.join(", ")}`,
      severity: "blocker",
    });
  }

  let workerLastSuccessAt: string | null = null;
  let workerOverdue = true;
  if (dbOk) {
    const job = await prisma.opsJobRun.findUnique({ where: { jobKey: "ncc-settlement-workers" } });
    workerLastSuccessAt = job?.lastSuccessAt?.toISOString() ?? null;
    workerOverdue =
      !job?.lastSuccessAt || Date.now() - job.lastSuccessAt.getTime() > NCC_WORKER_OVERDUE_MS;
    if (workerOverdue) {
      blockers.push({
        code: "WORKER_OVERDUE_OR_NEVER_SUCCEEDED",
        message: "NCC settlement worker has no recent successful run.",
        severity: "blocker",
      });
    }

    const legacyFloats = await countUnexplainedLegacyFloats();
    if (legacyFloats > 0) {
      blockers.push({
        code: "UNEXPLAINED_LEGACY_FLOAT",
        message: `${legacyFloats} settlement account(s) still require legacy float review.`,
        severity: "blocker",
      });
    }

    const uncertifiedLive = await prisma.nccParticipantConnector.count({
      where: {
        status: "ACTIVE",
        certificationStatus: { not: "PASSED" },
        institution: { status: "ACTIVE", isAlta: false },
      },
    });
    if (uncertifiedLive > 0) {
      blockers.push({
        code: "UNCERTIFIED_ACTIVE_EXTERNAL_CONNECTOR",
        message: `${uncertifiedLive} ACTIVE non-Alta connector(s) lack passed certification.`,
        severity: "blocker",
      });
    }

    const activeInstitutions = await prisma.financialInstitution.findMany({
      where: { status: "ACTIVE", isNCCParticipant: true, isAlta: false },
      select: { id: true, displayName: true },
    });
    let missingDocs = 0;
    for (const inst of activeInstitutions) {
      const accepted = await prisma.nccParticipantDocument.count({
        where: { institutionId: inst.id, status: "ACCEPTED" },
      });
      if (accepted === 0) missingDocs += 1;
    }
    if (missingDocs > 0) {
      blockers.push({
        code: "ACTIVE_INSTITUTION_MISSING_REGULATORY_DOCUMENTS",
        message: `${missingDocs} ACTIVE non-Alta institution(s) lack accepted regulatory documents.`,
        severity: "blocker",
      });
    }

    const criticalAlerts = await prisma.nccOperationalAlert.count({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] }, severity: "CRITICAL" },
    });
    if (criticalAlerts > 0) {
      blockers.push({
        code: "UNRESOLVED_CRITICAL_ALERTS",
        message: `${criticalAlerts} unresolved CRITICAL operational alert(s).`,
        severity: "blocker",
      });
    }

    const expiredDocs = await countExpiredRegulatoryDocuments();
    if (expiredDocs > 0) {
      warnings.push({
        code: "EXPIRED_REGULATORY_DOCUMENTS",
        message: `${expiredDocs} expired regulatory document(s) require compliance action.`,
        severity: "warning",
      });
    }

    const network = await prisma.nccNetworkControl.findUnique({ where: { id: "default" } });
    if (!network) {
      blockers.push({
        code: "NETWORK_MODE_UNKNOWN",
        message: "Network settlement control row is missing.",
        severity: "blocker",
      });
    } else if (network.mode !== "ACTIVE") {
      warnings.push({
        code: "NETWORK_NOT_ACTIVE",
        message: `Network settlement mode is ${network.mode}.`,
        severity: "warning",
      });
    }
  }

  // Unsafe activation path must remain disabled.
  const adminSource = await import("@/server/ncc/ncc-admin.service");
  const approveSource = adminSource.approveInstitution.toString();
  if (!approveSource.includes("UNSAFE_ACTIVATION_BYPASS_DISABLED")) {
    blockers.push({
      code: "UNSAFE_ACTIVATION_PATH_PRESENT",
      message: "approveInstitution still appears to activate institutions directly.",
      severity: "blocker",
    });
  }

  const seedEnabled =
    process.env.ALLOW_PRODUCTION_SEED === "1" || process.env.ENABLE_PRODUCTION_SEED === "1";
  if (isProd && seedEnabled) {
    blockers.push({
      code: "PRODUCTION_SEED_ENABLED",
      message: "Production seed flags must be disabled.",
      severity: "blocker",
    });
  }

  return {
    ready: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    blockers,
    warnings,
    signals: {
      databaseConfigured: dbOk,
      sessionSecretConfigured: sessionOk,
      nccSecretsKeyConfigured: nccSecretsOk,
      cronSecretConfigured: cronOk,
      privateDocumentStorageConfigured: blobConfigured,
      workerLastSuccessAt,
      workerOverdue,
      stepUpMfaAvailable: NCC_STEP_UP_MFA_AVAILABLE,
      networkModeKnown: dbOk,
      productionSeedDisabled: !(isProd && seedEnabled),
    },
  };
}
